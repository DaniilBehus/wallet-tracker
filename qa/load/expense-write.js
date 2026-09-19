import http from 'k6/http';
import { check } from 'k6';
import { Trend, Counter } from 'k6/metrics';

/*
 * Load smoke: 50 users writing expenses at the same time.
 *
 * The question is not "how fast is it" — this is a personal app with one user,
 * and throughput numbers would mean nothing. The question is what SQLite and a
 * synchronous driver do when writes overlap, because `better-sqlite3` is
 * synchronous by design: every query blocks the Node event loop for its whole
 * duration.
 *
 * So there are two scenarios running at once:
 *
 *   writers  50 users POSTing transactions, flat out
 *   health   a trivial GET /api/health, 5 times a second, throughout
 *
 * The second one is the actual instrument. /api/health touches no user data and
 * does one `SELECT 1`; it should answer instantly whatever else is happening.
 * If its latency climbs while the writers run, the server is not slow at
 * writing — it is *blocked*, and every request behind the blocking one waits,
 * including requests that have nothing to do with the database.
 *
 * That distinction is the whole point: "writes are slow" is a database
 * property, "everything is slow while writes happen" is an architecture one.
 */

const BASE = __ENV.BASE_URL || 'http://localhost:3100';
const USERS = Number(__ENV.USERS || 50);
const DURATION = __ENV.DURATION || '30s';

const BASELINE = __ENV.BASELINE || '5s';

// Two separate trends for the same endpoint, before and during the load. A
// single number is not evidence of anything: "health answers in 20 ms" is only
// meaningful next to what it costs when nothing else is running.
const healthIdle = new Trend('health_latency_idle', true);
const healthLoaded = new Trend('health_latency_under_load', true);
const writeLatency = new Trend('write_latency', true);
const serverErrors = new Counter('server_errors');
const conflicts = new Counter('write_conflicts');

export const options = {
  scenarios: {
    // Phase 1: the server is idle. This is the baseline.
    healthBaseline: {
      executor: 'constant-arrival-rate',
      rate: 10,
      timeUnit: '1s',
      duration: BASELINE,
      preAllocatedVUs: 5,
      exec: 'pollHealthIdle',
      startTime: '0s',
    },
    // Phase 2: 50 users writing, and the same endpoint measured throughout.
    writers: {
      executor: 'constant-vus',
      vus: USERS,
      duration: DURATION,
      exec: 'writeExpense',
      startTime: BASELINE,
    },
    healthUnderLoad: {
      executor: 'constant-arrival-rate',
      rate: 10,
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: 10,
      exec: 'pollHealthLoaded',
      startTime: BASELINE,
    },
  },

  // Thresholds are the pass/fail line, and they are set at what this app should
  // manage rather than at what it happens to do — a threshold fitted to the
  // measurement can never fail.
  thresholds: {
    // No write may error. A 500 under load is still a 500 (spec §5).
    'http_req_failed{scenario:writers}': ['rate<0.01'],
    // An endpoint that does one SELECT 1 and touches no user data should stay
    // quick even while the database is busy.
    health_latency_under_load: ['p(95)<250'],
    server_errors: ['count==0'],
    checks: ['rate>0.99'],
  },
};

/** Registers the users once, before the load starts. */
export function setup() {
  const stamp = Date.now();
  const users = [];
  const started = Date.now();

  for (let i = 0; i < USERS; i++) {
    const body = JSON.stringify({
      email: `load-${stamp}-${i}@wallet.test`,
      password: `load-passphrase-${stamp}`,
    });
    const res = http.post(`${BASE}/api/auth/register`, body, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.status !== 201) {
      throw new Error(`registration ${i} failed: ${res.status} ${res.body}`);
    }
    const token = res.json('token');

    const categories = http.get(`${BASE}/api/categories`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    users.push({ token, categoryId: categories.json('0.id') });
  }

  const elapsed = Date.now() - started;
  console.log(
    `setup: registered ${USERS} users in ${elapsed} ms ` +
      `(${Math.round(elapsed / USERS)} ms each — bcrypt at 10 rounds, on the thread pool)`
  );

  return { users };
}

export function writeExpense(data) {
  const user = data.users[(__VU - 1) % data.users.length];

  const res = http.post(
    `${BASE}/api/transactions`,
    JSON.stringify({
      // Varying, and always a positive integer number of cents.
      amount_cents: 100 + (__ITER % 900),
      category_id: user.categoryId,
      note: `vu ${__VU} iter ${__ITER}`,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.token}`,
      },
      tags: { name: 'POST /api/transactions' },
    }
  );

  writeLatency.add(res.timings.duration);
  if (res.status >= 500) serverErrors.add(1);
  if (res.status === 409) conflicts.add(1);

  check(res, {
    'write returns 201': (r) => r.status === 201,
    'write never returns 500': (r) => r.status < 500,
  });
}

function pollHealth(trend) {
  const res = http.get(`${BASE}/api/health`, { tags: { name: 'GET /api/health' } });

  trend.add(res.timings.duration);
  if (res.status >= 500) serverErrors.add(1);

  check(res, {
    'health returns 200': (r) => r.status === 200,
    'health reports the database as ok': (r) => r.json('db') === 'ok',
  });
}

export function pollHealthIdle() {
  pollHealth(healthIdle);
}

export function pollHealthLoaded() {
  pollHealth(healthLoaded);
}

/** A readable summary, plus the raw numbers next to the other test reports. */
export function handleSummary(data) {
  const m = data.metrics;
  const value = (name, field) =>
    m[name] && m[name].values && m[name].values[field] !== undefined
      ? m[name].values[field]
      : null;

  const ms = (v) => (v === null ? 'n/a' : `${v.toFixed(1)} ms`);
  const idle = value('health_latency_idle', 'p(95)');
  const loaded = value('health_latency_under_load', 'p(95)');
  const factor = idle && loaded ? (loaded / idle).toFixed(1) : '?';

  const lines = [
    '',
    `  writes            ${value('http_reqs', 'count')} requests, ` +
      `${(value('http_reqs', 'rate') || 0).toFixed(0)}/s`,
    `  failed            ${((value('http_req_failed', 'rate') || 0) * 100).toFixed(3)} %`,
    `  server errors     ${value('server_errors', 'count')}`,
    `  write latency     avg ${ms(value('write_latency', 'avg'))}   ` +
      `p95 ${ms(value('write_latency', 'p(95)'))}   max ${ms(value('write_latency', 'max'))}`,
    '',
    '  GET /api/health — the same trivial request, measured twice:',
    `    idle            avg ${ms(value('health_latency_idle', 'avg'))}   ` +
      `p95 ${ms(idle)}`,
    `    under load      avg ${ms(value('health_latency_under_load', 'avg'))}   ` +
      `p95 ${ms(loaded)}`,
    `    cost of load    ${factor}× slower at p95`,
    '',
  ];

  return {
    stdout: lines.join('\n') + '\n',
    'qa/reports/load-summary.json': JSON.stringify(data, null, 2),
  };
}

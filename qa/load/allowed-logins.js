import http from 'k6/http';
import { check } from 'k6';
import { Trend, Counter } from 'k6/metrics';

/*
 * What do the logins the limiter ALLOWS cost everybody else?
 *
 * BUG-004 was closed on its symptom: rate limiting capped how often bcrypt can
 * be reached, and health latency under a burst fell from 1819 ms to 5.2 ms. But
 * the report recorded a residual, and LIMIT-001 describes the same mechanism —
 * every attempt that *is* allowed still costs ~50 ms of CPU that Node spends
 * instead of serving anything else, because `bcrypt.compareSync` is
 * synchronous.
 *
 * The burst script cannot see that: after five attempts everything is a 429,
 * and refusing is cheap, so the expensive part is hidden behind the limiter it
 * hides behind. So this script deliberately runs against a server whose limiter
 * is effectively switched off (LOGIN_MAX_FAILURES is set very high by
 * qa/load/run.js), which isolates the one question being asked:
 *
 *     with the limiter out of the way, does one login block the server?
 *
 * That is not a realistic deployment. It is a measurement of the residual, and
 * the limiter's own contribution is already proved by BUG-004's before/after.
 */

const BASE = __ENV.BASE_URL || 'http://localhost:3100';
const CONCURRENCY = Number(__ENV.CONCURRENCY || 5);   // the size of the allowance
const DURATION = __ENV.DURATION || '15s';
const BASELINE = __ENV.BASELINE || '5s';

const healthIdle = new Trend('health_latency_idle', true);
const healthLoaded = new Trend('health_latency_under_load', true);
const loginLatency = new Trend('login_latency', true);
const reachedBcrypt = new Counter('logins_reached_bcrypt');
const rateLimited = new Counter('logins_rate_limited');

export const options = {
  scenarios: {
    healthBaseline: {
      executor: 'constant-arrival-rate',
      rate: 20,
      timeUnit: '1s',
      duration: BASELINE,
      preAllocatedVUs: 10,
      exec: 'pollHealthIdle',
      startTime: '0s',
    },
    logins: {
      executor: 'constant-vus',
      vus: CONCURRENCY,
      duration: DURATION,
      exec: 'attemptLogin',
      startTime: BASELINE,
    },
    healthUnderLoad: {
      executor: 'constant-arrival-rate',
      rate: 20,
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: 40,
      maxVUs: 80,
      exec: 'pollHealthLoaded',
      startTime: BASELINE,
    },
  },

  thresholds: {
    // The line the whole change is about. Synchronous bcrypt cannot hold it;
    // asynchronous bcrypt should not notice.
    health_latency_under_load: ['p(95)<100'],
    checks: ['rate>0.99'],
  },
};

export function setup() {
  const stamp = Date.now();
  const email = `allowed-${stamp}@wallet.test`;
  const res = http.post(
    `${BASE}/api/auth/register`,
    JSON.stringify({ email, password: `allowed-passphrase-${stamp}` }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  if (res.status !== 201) throw new Error(`setup registration failed: ${res.status}`);
  return { email };
}

export function attemptLogin(data) {
  // A real account with the wrong password, so the server reaches bcrypt. An
  // unknown address is rejected before any hashing and would measure nothing.
  const res = http.post(
    `${BASE}/api/auth/login`,
    JSON.stringify({ email: data.email, password: `wrong-${__VU}-${__ITER}` }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'POST /api/auth/login' },
    }
  );

  loginLatency.add(res.timings.duration);
  if (res.status === 401) reachedBcrypt.add(1);
  if (res.status === 429) rateLimited.add(1);

  check(res, { 'the attempt is refused, not accepted': (r) => r.status !== 200 });
}

function pollHealth(trend) {
  const res = http.get(`${BASE}/api/health`, { tags: { name: 'GET /api/health' } });
  trend.add(res.timings.duration);
  check(res, { 'health returns 200': (r) => r.status === 200 });
}

export function pollHealthIdle() {
  pollHealth(healthIdle);
}

export function pollHealthLoaded() {
  pollHealth(healthLoaded);
}

export function handleSummary(data) {
  const m = data.metrics;
  const value = (name, field) =>
    m[name] && m[name].values && m[name].values[field] !== undefined
      ? m[name].values[field]
      : null;

  const ms = (v) => (v === null ? 'n/a' : `${v.toFixed(1)} ms`);
  const count = (name) => value(name, 'count') || 0;
  const idle = value('health_latency_idle', 'p(95)');
  const loaded = value('health_latency_under_load', 'p(95)');
  const factor = idle && loaded ? (loaded / idle).toFixed(1) : '?';

  const lines = [
    '',
    `  concurrent logins ${CONCURRENCY}, all of them reaching bcrypt`,
    `  reached bcrypt    ${count('logins_reached_bcrypt')}`,
    `  rate limited      ${count('logins_rate_limited')}` +
      `${count('logins_rate_limited') ? '  <- the limiter is NOT out of the way' : '  (limiter out of the way, as intended)'}`,
    `  login latency     avg ${ms(value('login_latency', 'avg'))}   ` +
      `p95 ${ms(value('login_latency', 'p(95)'))}`,
    '',
    '  GET /api/health — the same trivial request, measured twice:',
    `    idle            avg ${ms(value('health_latency_idle', 'avg'))}   p95 ${ms(idle)}`,
    `    under load      avg ${ms(value('health_latency_under_load', 'avg'))}   p95 ${ms(loaded)}`,
    `    cost of load    ${factor}× slower at p95`,
    '',
  ];

  return {
    stdout: lines.join('\n') + '\n',
    'qa/reports/load-allowed-summary.json': JSON.stringify(data, null, 2),
  };
}

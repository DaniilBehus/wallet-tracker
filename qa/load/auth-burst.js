import http from 'k6/http';
import { check } from 'k6';
import { Trend, Counter } from 'k6/metrics';

/*
 * A burst of failed logins, and what it costs the rest of the server.
 *
 * The write smoke (expense-write.js) found that a busy database makes every
 * other request wait. This one goes after a sharper version of the same thing:
 * `src/auth.js` uses `bcrypt.compareSync`, and bcrypt at 10 rounds is
 * deliberately expensive — tens of milliseconds of pure CPU, by design.
 *
 * Synchronous plus single-threaded means those milliseconds are not spent
 * *alongside* other work, they are spent *instead of* it. So the question is
 * not "how many logins per second" but: while somebody guesses passwords, is
 * the application still usable by everyone else?
 *
 * Nothing here is an attack on anything. It is one account, its own throwaway
 * server, and the wrong password — which is exactly what a rate limiter is
 * supposed to make cheap to refuse, and is why this measurement is taken
 * before that limiter is built.
 */

const BASE = __ENV.BASE_URL || 'http://localhost:3100';
const ATTACKERS = Number(__ENV.ATTACKERS || 20);
const DURATION = __ENV.DURATION || '15s';
const BASELINE = __ENV.BASELINE || '5s';

const healthIdle = new Trend('health_latency_idle', true);
const healthLoaded = new Trend('health_latency_under_load', true);
const loginLatency = new Trend('login_latency', true);
const rejected = new Counter('logins_rejected');
const rateLimited = new Counter('logins_rate_limited');

export const options = {
  scenarios: {
    healthBaseline: {
      executor: 'constant-arrival-rate',
      rate: 10,
      timeUnit: '1s',
      duration: BASELINE,
      preAllocatedVUs: 5,
      exec: 'pollHealthIdle',
      startTime: '0s',
    },
    attackers: {
      executor: 'constant-vus',
      vus: ATTACKERS,
      duration: DURATION,
      exec: 'guessPassword',
      startTime: BASELINE,
    },
    healthUnderLoad: {
      executor: 'constant-arrival-rate',
      rate: 10,
      timeUnit: '1s',
      duration: DURATION,
      // Generous, because the first run could not keep 10/s: each health
      // request was taking about a second, so ten VUs ran out. Dropped
      // iterations would flatter the result by not measuring the worst of it.
      preAllocatedVUs: 30,
      maxVUs: 60,
      exec: 'pollHealthLoaded',
      startTime: BASELINE,
    },
  },

  thresholds: {
    // The same line the write smoke holds to. Whether this passes is the
    // finding, either way.
    health_latency_under_load: ['p(95)<250'],
    checks: ['rate>0.99'],
  },
};

export function setup() {
  const stamp = Date.now();
  const email = `burst-${stamp}@wallet.test`;
  const password = `burst-passphrase-${stamp}`;

  const res = http.post(
    `${BASE}/api/auth/register`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  if (res.status !== 201) throw new Error(`setup registration failed: ${res.status}`);

  return { email };
}

export function guessPassword(data) {
  // A real account with the wrong password, so the server reaches bcrypt.
  // An unknown e-mail would be rejected before any hashing happens and would
  // measure nothing.
  const res = http.post(
    `${BASE}/api/auth/login`,
    JSON.stringify({ email: data.email, password: `wrong-${__VU}-${__ITER}` }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'POST /api/auth/login' },
    }
  );

  loginLatency.add(res.timings.duration);
  if (res.status === 401) rejected.add(1);
  if (res.status === 429) rateLimited.add(1);

  check(res, {
    'wrong password is refused': (r) => r.status === 401 || r.status === 429,
    'never a 500': (r) => r.status < 500,
  });
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
  const idle = value('health_latency_idle', 'p(95)');
  const loaded = value('health_latency_under_load', 'p(95)');
  const factor = idle && loaded ? (loaded / idle).toFixed(1) : '?';

  const count = (name) => value(name, 'count') || 0;
  const attempts = count('logins_rejected') + count('logins_rate_limited');

  const lines = [
    '',
    `  login attempts    ${attempts} in ${DURATION}  ` +
      `(${(attempts / parseInt(DURATION, 10)).toFixed(0)}/s)`,
    `  refused 401       ${count('logins_rejected')}`,
    `  rate limited 429  ${count('logins_rate_limited')}` +
      `${count('logins_rate_limited') ? '' : '  <- nothing stops a guesser yet'}`,
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
    'qa/reports/load-auth-summary.json': JSON.stringify(data, null, 2),
  };
}

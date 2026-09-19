'use strict';

// Quotas and concurrency against a real SQLite file (never data/wallet.db),
// with an injected clock.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT = path.join(__dirname, '..', '..', '..');
const { createLimits } = require(path.join(ROOT, 'src', 'ai', 'limits'));
const SCHEMA = fs.readFileSync(path.join(ROOT, 'src', 'schema.sql'), 'utf8');

function fresh() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-limits-'));
  const file = path.join(dir, 'limits.db');
  const open = () => {
    const db = new Database(file);
    db.pragma('busy_timeout = 5000');
    db.exec(SCHEMA);
    return db;
  };
  return { open, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

const LIMITS = { globalDaily: 20, userDaily: 5, userMinute: 3, maxConcurrent: 2, perUserConcurrent: 1 };
const clockAt = (iso) => {
  let now = new Date(iso);
  return { now: () => now, set: (v) => { now = new Date(v); } };
};
const is429 = (e) => e.status === 429 && e.code === 'AI_RATE_LIMITED' && Number.isInteger(e.retryAfter) && e.retryAfter > 0;

test('per-user minute cap: the third call passes, the fourth is 429 with Retry-After', (t) => {
  const f = fresh();
  t.after(f.cleanup);
  const db = f.open();
  const clock = clockAt('2026-09-14T10:15:20');
  const limits = createLimits({ db, limits: LIMITS, clock });
  limits.reserve(1); limits.reserve(1); limits.reserve(1);
  assert.throws(() => limits.reserve(1), is429);
  clock.set('2026-09-14T10:16:00');
  assert.doesNotThrow(() => limits.reserve(1));
  db.close();
});

test('per-user daily cap and global daily cap', (t) => {
  const f = fresh();
  t.after(f.cleanup);
  const db = f.open();
  const clock = clockAt('2026-09-14T08:00:00');
  const limits = createLimits({ db, limits: { ...LIMITS, userMinute: 100 }, clock });
  for (let i = 0; i < 5; i++) limits.reserve(7);
  assert.throws(() => limits.reserve(7), is429);
  // Global: 20 per day across users.
  for (let u = 100; u < 115; u++) limits.reserve(u);
  assert.throws(() => limits.reserve(999), is429, 'the 21st call of the day');
  clock.set('2026-09-15T00:00:01');
  assert.doesNotThrow(() => limits.reserve(999), 'a new server-local day');
  db.close();
});

test('a refused reservation changes nothing (the transaction rolls back)', (t) => {
  const f = fresh();
  t.after(f.cleanup);
  const db = f.open();
  const limits = createLimits({ db, limits: { ...LIMITS, userMinute: 1 }, clock: clockAt('2026-09-14T09:00:00') });
  limits.reserve(3);
  const before = db.prepare('SELECT SUM(count) AS s FROM ai_quota').get().s;
  assert.throws(() => limits.reserve(3), is429);
  assert.equal(db.prepare('SELECT SUM(count) AS s FROM ai_quota').get().s, before);
  db.close();
});

test('quotas survive a restart: a new process on the same database sees the counts', (t) => {
  const f = fresh();
  t.after(f.cleanup);
  const clock = clockAt('2026-09-14T11:00:00');
  const first = f.open();
  const a = createLimits({ db: first, limits: { ...LIMITS, userMinute: 100 }, clock });
  for (let i = 0; i < 5; i++) a.reserve(42);
  first.close();

  const second = f.open();
  const b = createLimits({ db: second, limits: { ...LIMITS, userMinute: 100 }, clock });
  assert.throws(() => b.reserve(42), is429);
  second.close();
});

test('only counters are stored — no text column exists to hold a description', (t) => {
  const f = fresh();
  t.after(f.cleanup);
  const db = f.open();
  const columns = db.prepare("SELECT name FROM pragma_table_info('ai_quota')").all().map((c) => c.name);
  assert.deepEqual(columns.sort(), ['count', 'period', 'scope', 'user_id']);
  db.close();
});

test('old rows are pruned after two days', (t) => {
  const f = fresh();
  t.after(f.cleanup);
  const db = f.open();
  const clock = clockAt('2026-09-10T12:00:00');
  const limits = createLimits({ db, limits: LIMITS, clock });
  limits.reserve(1);
  clock.set('2026-09-14T12:00:00');
  limits.reserve(1);
  const periods = db.prepare('SELECT DISTINCT substr(period,1,10) AS d FROM ai_quota').all().map((r) => r.d);
  assert.deepEqual(periods, ['2026-09-14']);
  db.close();
});

test('concurrency: one in flight per user, two globally, released exactly once', (t) => {
  const f = fresh();
  t.after(f.cleanup);
  const db = f.open();
  const limits = createLimits({ db, limits: LIMITS, clock: clockAt('2026-09-14T12:00:00') });

  const r1 = limits.acquireSlot(1);
  assert.throws(() => limits.acquireSlot(1), is429, 'same user twice');
  const r2 = limits.acquireSlot(2);
  assert.throws(() => limits.acquireSlot(3), is429, 'third request globally');
  r1();
  r1();                                  // double release is harmless
  assert.deepEqual(limits.snapshot(), { global: 1, users: 1 });
  const r3 = limits.acquireSlot(3);
  r2(); r3();
  assert.deepEqual(limits.snapshot(), { global: 0, users: 0 });
  db.close();
});

test('a slot is released when the work in between throws', async (t) => {
  const f = fresh();
  t.after(f.cleanup);
  const db = f.open();
  const limits = createLimits({ db, limits: LIMITS, clock: clockAt('2026-09-14T12:00:00') });
  async function guarded() {
    const release = limits.acquireSlot(5);
    try {
      throw new Error('provider exploded');
    } finally {
      release();
    }
  }
  await assert.rejects(guarded(), /provider exploded/);
  assert.deepEqual(limits.snapshot(), { global: 0, users: 0 });
  db.close();
});

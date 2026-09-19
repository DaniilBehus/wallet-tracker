'use strict';

// Evaluator-only rolling rate window (S29, D-043): at most 5 provider calls in
// any rolling 10 minutes, for `qa/ai/evaluate.js --live` only.
//
//   * stored in the evaluation database, so a restart or a second process
//     cannot reset or overbook it;
//   * a run that does not fit is refused before any request, and says when the
//     next call becomes available;
//   * each slot is reserved atomically immediately before dispatch, and a
//     failed request keeps its slot;
//   * rows are never deleted, so the database keeps its history;
//   * the application's own limits and database are not involved.
//
// The evaluator runs as a child process with the network guard; its requests
// go to local fakes. No real Gemini or OpenAI request is possible here.

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const { EVAL_WINDOW, ensureWindowTable, windowState, readWindowState, reserveCall, EvalWindowFull, availabilityText } = require('../eval-window');
const { createFakeOpenAI } = require('../support/fake-openai');
const { createFakeGemini } = require('../support/fake-gemini');
const { ROOT, liveEnv, runEvaluator, callsAttempted, reportPaths, makeWalletCopy, sha256File } = require('../support/eval-cli');

const ROWS = fs.readFileSync(path.join(ROOT, 'qa', 'ai', 'data', 'eval-cases.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const DEV = ROWS.filter((r) => r.split === 'dev' && r.kind === 'nl');
const MIN = 60 * 1000;
const WINDOW_MS = 10 * MIN;
const GEMINI = { WALLET_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'gemini-window-test-key-not-real', WALLET_AI_GEMINI_MODEL: 'gemini-window-test-model' };

// The checkout's own evidence is only ever read here; it must be byte-identical at the end.
const EVIDENCE = ['data/wallet.db', 'data/wallet.db-wal', 'data/wallet.db-shm', 'data/ai-eval.db',
  'qa/reports/ai-eval/live-2026-09-17T10-33-54-426Z.json', 'qa/reports/ai-eval/live-2026-09-17T10-33-54-426Z.md']
  .map((rel) => path.join(ROOT, rel));
const evidenceHashes = () => EVIDENCE.map((p) => (fs.existsSync(p) ? sha256File(p) : null));

let dir;
let openai;
let openaiUrl;
let gemini;
let geminiUrl;
let evidenceBefore;

test.before(async () => {
  evidenceBefore = evidenceHashes();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-ai-window-'));
  openai = createFakeOpenAI();
  gemini = createFakeGemini();
  openaiUrl = await openai.listen();
  geminiUrl = await gemini.listen();
});

test.after(async () => {
  await openai.close();
  await gemini.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test.beforeEach(() => {
  openai.reset();
  gemini.reset();
});

const at = (ms) => () => ms;
const slot = (over = {}) => ({ provider: 'openai', model: 'window-test-model', kind: 'local_fake', rowId: 'AI-EVAL-001', ...over });

function freshDb(name) {
  const file = path.join(dir, `${name}.db`);
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  ensureWindowTable(db);
  return { db, file };
}

/** A fresh window database for `fn`, closed even when an assertion fails. */
function withDb(name, fn) {
  const { db, file } = freshDb(name);
  try {
    return fn(db, file);
  } finally {
    if (db.open) db.close();
  }
}

function evalDbAt(name) {
  const file = path.join(dir, name, 'ai-eval.db');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return file;
}

/** Reservations at the given times, written by the module itself, as another process would. */
function seed(file, times) {
  const db = new Database(file);
  try {
    db.pragma('journal_mode = WAL');
    ensureWindowTable(db);
    for (const t of times) reserveCall(db, { ...slot({ rowId: 'SEEDED', model: 'earlier-run' }), clock: at(t) });
  } finally {
    db.close();
  }
}

function rowsIn(file) {
  if (!fs.existsSync(file)) return 0;
  const db = new Database(file, { readonly: true });
  try {
    return db.prepare('SELECT COUNT(*) AS n FROM eval_provider_calls').get().n;
  } finally {
    db.close();
  }
}

function earliestInWindow(file, now = Date.now()) {
  const db = new Database(file, { readonly: true });
  try {
    return db.prepare('SELECT MIN(reserved_at_ms) AS t FROM eval_provider_calls WHERE reserved_at_ms > ?').get(now - WINDOW_MS).t;
  } finally {
    db.close();
  }
}

async function waitFor(predicate, what, timeoutMs = 20000) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 20));
  }
}

const planOpenAI = (n) => { for (let i = 0; i < n; i++) openai.plan({ output: DEV[i].fixture_output }); };
const REFUSED = /LIVE NOT RUN: evaluation rate limit: 5 provider calls per rolling 10 minutes; (\d+) used, (\d+) free, this run plans (\d+); next (?:call|\d+ calls) available at (\S+) \(in (\d+) s\)/;

// ------------------------------------------------------------------- module

test('W1 · the limit is exactly 5 calls in a rolling 10 minutes; five reservations inside the window all succeed', () => {
  assert.deepEqual({ ...EVAL_WINDOW }, { calls: 5, ms: WINDOW_MS });
  assert.ok(Object.isFrozen(EVAL_WINDOW), 'the limit cannot be raised at run time');
  withDb('w1', (db) => {
    const t0 = Date.UTC(2026, 8, 17, 12, 0, 0);
    for (let i = 0; i < 5; i++) {
      const r = reserveCall(db, { ...slot(), clock: at(t0 + i * MIN) });
      assert.equal(r.used, i + 1);
    }
    assert.deepEqual(windowState(db, t0 + 5 * MIN), { used: 5, limit: 5, free: 0, availableAtMs: t0 + WINDOW_MS });
    assert.deepEqual(windowState(db, t0 + 5 * MIN, 3), { used: 5, limit: 5, free: 0, availableAtMs: t0 + 2 * MIN + WINDOW_MS }, 'three free slots need the three oldest to expire');
    assert.equal(windowState(db, t0 + 5 * MIN, 6).availableAtMs, Infinity, 'six calls never fit one window');
  });
});

test('W2 · the sixth call inside the window is refused before anything is written, with the time the next call becomes available', () => {
  withDb('w2', (db) => {
    const t0 = Date.UTC(2026, 8, 17, 12, 0, 0);
    for (let i = 0; i < 5; i++) reserveCall(db, { ...slot(), clock: at(t0 + i * MIN) });
    const count = () => db.prepare('SELECT COUNT(*) AS n FROM eval_provider_calls').get().n;
    assert.throws(() => reserveCall(db, { ...slot(), clock: at(t0 + 9 * MIN) }), (e) => {
      assert.ok(e instanceof EvalWindowFull);
      assert.equal(e.code, 'EVAL_WINDOW_FULL');
      assert.equal(e.used, 5);
      assert.equal(e.availableAtMs, t0 + WINDOW_MS);
      return true;
    });
    assert.equal(count(), 5, 'a refusal writes nothing');
    assert.equal(availabilityText(t0 + WINDOW_MS, t0 + 9 * MIN), `at ${new Date(t0 + WINDOW_MS).toISOString()} (in 60 s)`);
    assert.equal(availabilityText(null, t0), 'now');
  });
});

test('W3 · a call leaves the window exactly 10 minutes after its reservation; expired rows stay as history', () => {
  withDb('w3', (db) => {
    const t0 = Date.UTC(2026, 8, 17, 12, 0, 0);
    for (let i = 0; i < 5; i++) reserveCall(db, { ...slot(), clock: at(t0 + i * MIN) });
    assert.throws(() => reserveCall(db, { ...slot(), clock: at(t0 + WINDOW_MS - 1) }), EvalWindowFull);
    assert.equal(reserveCall(db, { ...slot(), clock: at(t0 + WINDOW_MS) }).used, 5, 'the oldest call expired exactly at +10 min');
    assert.throws(() => reserveCall(db, { ...slot(), clock: at(t0 + WINDOW_MS) }), (e) => e.availableAtMs === t0 + MIN + WINDOW_MS);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM eval_provider_calls').get().n, 6, 'nothing is deleted');
    // A clock set back does not reopen the window: a reservation "in the future" still counts.
    assert.throws(() => reserveCall(db, { ...slot(), clock: at(t0 - MIN) }), EvalWindowFull);
  });
});

test('W4 · the window survives a restart, and reading it changes nothing', () => {
  const file = withDb('w4', (db, f) => {
    for (let i = 0; i < 5; i++) reserveCall(db, slot());
    return f;
  });

  const reopened = new Database(file);
  try {
    assert.throws(() => reserveCall(reopened, slot()), EvalWindowFull);
  } finally {
    reopened.close();
  }

  const before = sha256File(file);
  assert.equal(readWindowState(file).used, 5);
  assert.equal(sha256File(file), before, 'a read-only look does not write');

  const missing = path.join(dir, 'w4-missing.db');
  assert.deepEqual(readWindowState(missing), { used: 0, limit: 5, free: 5, availableAtMs: null });
  assert.equal(fs.existsSync(missing), false, 'reading a missing database does not create it');

  const noTable = path.join(dir, 'w4-no-table.db');
  const plain = new Database(noTable);
  plain.exec('CREATE TABLE other (x INTEGER)');
  plain.close();
  const plainBefore = sha256File(noTable);
  assert.equal(readWindowState(noTable).used, 0, 'an evaluation database from before the window counts as empty');
  assert.equal(sha256File(noTable), plainBefore, 'and is not migrated by a read');
});

test('W5 · concurrent processes cannot overbook: 8 processes x 3 attempts on one file give exactly 5 reservations', async () => {
  const file = withDb('w5', (db, f) => f);
  const barrier = path.join(dir, 'w5-go');
  const script = `
    const fs = require('fs');
    const Database = require('better-sqlite3');
    const { reserveCall } = require(${JSON.stringify(path.join(ROOT, 'qa', 'ai', 'eval-window.js'))});
    const db = new Database(${JSON.stringify(file)}, { timeout: 30000 });
    process.stdout.write('ready\\n');
    const pause = new Int32Array(new SharedArrayBuffer(4));
    while (!fs.existsSync(${JSON.stringify(barrier)})) Atomics.wait(pause, 0, 0, 5);
    let ok = 0;
    let refused = 0;
    for (let i = 0; i < 3; i++) {
      try {
        reserveCall(db, { provider: 'openai', model: 'm', kind: 'local_fake', rowId: 'W5-' + process.pid + '-' + i });
        ok += 1;
      } catch (e) {
        if (e.code !== 'EVAL_WINDOW_FULL') throw e;
        refused += 1;
      }
    }
    db.close();
    process.stdout.write(JSON.stringify({ ok, refused }) + '\\n');
  `;
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP,
    NODE_PATH: path.resolve(path.dirname(require.resolve('better-sqlite3/package.json')), '..') };
  let ready = 0;
  const children = Array.from({ length: 8 }, () => new Promise((resolve) => {
    const child = spawn(process.execPath, ['-e', script], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => {
      if (!out.includes('ready') && `${out}${d}`.includes('ready')) ready += 1;
      out += d;
    });
    child.stderr.on('data', (d) => { err += d; });
    child.on('exit', (code) => resolve({ code, out, err }));
  }));
  await waitFor(() => ready === 8, 'all eight processes to open the database');
  fs.writeFileSync(barrier, 'go');
  const results = await Promise.all(children);
  for (const r of results) assert.equal(r.code, 0, r.err);
  const parsed = results.map((r) => JSON.parse(r.out.trim().split('\n').pop()));
  assert.equal(parsed.reduce((s, p) => s + p.ok, 0), 5, JSON.stringify(parsed));
  assert.equal(parsed.reduce((s, p) => s + p.refused, 0), 19);
  assert.equal(rowsIn(file), 5);
});

// -------------------------------------------------------------- evaluator

test('W6 · across restarts and providers: 3 + 2 calls run, a run that does not fit and a sixth call are refused before any request, with the time', async () => {
  const evalDb = evalDbAt('w6');
  const env = liveEnv({ WALLET_AI_EVAL_DB: evalDb });   // daily allowance 200: only the window decides here

  planOpenAI(3);
  const first = await runEvaluator({ args: ['--live', '--limit', '3'], env, fakeUrl: openaiUrl });
  assert.equal(callsAttempted(first.out), 3, first.out);
  assert.equal(openai.requests.length, 3);
  const paths = reportPaths(first.out);
  const report = JSON.parse(fs.readFileSync(paths.json, 'utf8'));
  assert.deepEqual(report.allowance.window, { calls: 5, minutes: 10, used_before_run: 0 });
  assert.match(fs.readFileSync(paths.md, 'utf8'), /^- Evaluation rate window: 5 provider calls per rolling 10 minutes; 0 used when this run started$/m);
  fs.rmSync(paths.json, { force: true });
  fs.rmSync(paths.md, { force: true });

  openai.reset();
  planOpenAI(3);
  const tooMany = await runEvaluator({ args: ['--live', '--limit', '3'], env, fakeUrl: openaiUrl });
  assert.equal(tooMany.code, 3, tooMany.out);
  const m1 = tooMany.out.match(REFUSED);
  assert.ok(m1, tooMany.out);
  assert.deepEqual(m1.slice(1, 4).map(Number), [3, 2, 3]);
  assert.equal(openai.requests.length, 0);
  assert.doesNotMatch(tooMany.out, /^report: /m, 'a refused run writes no report');
  assert.equal(rowsIn(evalDb), 3);

  // A new process, another provider: the same window.
  gemini.plan({ output: DEV[3].fixture_output });
  gemini.plan({ output: DEV[4].fixture_output });
  const second = await runEvaluator({ args: ['--live', '--limit', '2'], env: { ...env, ...GEMINI }, fakeUrl: geminiUrl });
  assert.equal(callsAttempted(second.out), 2, second.out);
  assert.equal(gemini.requests.length, 2);
  const secondPaths = reportPaths(second.out);
  fs.rmSync(secondPaths.json, { force: true });
  fs.rmSync(secondPaths.md, { force: true });

  openai.reset();
  planOpenAI(1);
  const sixth = await runEvaluator({ args: ['--live', '--limit', '1'], env, fakeUrl: openaiUrl });
  assert.equal(sixth.code, 3, sixth.out);
  const m2 = sixth.out.match(REFUSED);
  assert.ok(m2, sixth.out);
  assert.deepEqual(m2.slice(1, 4).map(Number), [5, 0, 1]);
  assert.equal(m2[4], new Date(earliestInWindow(evalDb) + WINDOW_MS).toISOString(), 'the next call is when the oldest of the five leaves the window');
  assert.ok(Number(m2[5]) > 0 && Number(m2[5]) <= 600);
  assert.equal(openai.requests.length, 0);
  assert.equal(rowsIn(evalDb), 5);

  const before = sha256File(evalDb);
  const dry = await runEvaluator({ args: ['--live', '--dry-run'], env, fakeUrl: openaiUrl });
  assert.equal(dry.code, 0, dry.out);
  assert.match(dry.out, /evaluation window: 5 of 5 provider calls used in the last 10 minutes; next call available at \S+ \(in \d+ s\)/);
  assert.equal(sha256File(evalDb), before, 'a dry run does not change the window');

  const tooBig = await runEvaluator({ args: ['--live', '--limit', '6'], env: liveEnv({ WALLET_AI_EVAL_DB: evalDbAt('w6-big') }), fakeUrl: openaiUrl });
  assert.equal(tooBig.code, 3, tooBig.out);
  assert.match(tooBig.out, /LIVE NOT RUN: evaluation rate limit: at most 5 provider calls per rolling 10 minutes, and this run plans 6; use --limit 5 or less/);
  assert.equal(openai.requests.length, 0);
});

test('W7 · a failed request still uses its slot: a 500, a 400 and a timeout leave 3 of 5 used', async () => {
  const evalDb = evalDbAt('w7');
  const env = liveEnv({ WALLET_AI_EVAL_DB: evalDb, WALLET_AI_TIMEOUT_MS: '1000' });
  openai.plan({ status: 500 });
  openai.plan({ status: 400 });
  openai.plan({ output: DEV[2].fixture_output, delayMs: 2500 });
  const failing = await runEvaluator({ args: ['--live', '--limit', '3'], env, fakeUrl: openaiUrl });
  assert.equal(callsAttempted(failing.out), 3, failing.out);
  assert.equal(openai.requests.length, 3);
  assert.match(failing.out, /RESULT=FAIL/);
  assert.equal(rowsIn(evalDb), 3, 'every attempted request kept its reservation');
  const failingPaths = reportPaths(failing.out);
  fs.rmSync(failingPaths.json, { force: true });
  fs.rmSync(failingPaths.md, { force: true });

  openai.reset();
  planOpenAI(3);
  const next = await runEvaluator({ args: ['--live', '--limit', '3'], env, fakeUrl: openaiUrl });
  assert.equal(next.code, 3, next.out);
  assert.deepEqual(next.out.match(REFUSED).slice(1, 4).map(Number), [3, 2, 3]);
  assert.equal(openai.requests.length, 0);
});

test('W8 · calls older than 10 minutes no longer count; a call still inside the window does', async () => {
  const expired = evalDbAt('w8-expired');
  const old = Date.now() - WINDOW_MS - 5000;
  seed(expired, [old, old + 1, old + 2, old + 3, old + 4]);
  planOpenAI(1);
  const allowed = await runEvaluator({ args: ['--live', '--limit', '1'], env: liveEnv({ WALLET_AI_EVAL_DB: expired }), fakeUrl: openaiUrl });
  assert.equal(callsAttempted(allowed.out), 1, allowed.out);
  assert.equal(openai.requests.length, 1);
  assert.equal(rowsIn(expired), 6, 'the expired reservations are kept as history');
  const allowedPaths = reportPaths(allowed.out);
  fs.rmSync(allowedPaths.json, { force: true });
  fs.rmSync(allowedPaths.md, { force: true });

  openai.reset();
  const inside = evalDbAt('w8-inside');
  const oldest = Date.now() - WINDOW_MS + 30000;
  seed(inside, [oldest, oldest + 1000, oldest + 2000, oldest + 3000, oldest + 4000]);
  planOpenAI(1);
  const refused = await runEvaluator({ args: ['--live', '--limit', '1'], env: liveEnv({ WALLET_AI_EVAL_DB: inside }), fakeUrl: openaiUrl });
  assert.equal(refused.code, 3, refused.out);
  const m = refused.out.match(REFUSED);
  assert.ok(m, refused.out);
  assert.equal(m[4], new Date(oldest + WINDOW_MS).toISOString());
  assert.equal(openai.requests.length, 0);
  assert.equal(rowsIn(inside), 5);
});

test('W9 · three evaluator processes at once share one window: never more than 5 requests, each with its reservation', async () => {
  const evalDb = evalDbAt('w9');
  seed(evalDb, []);
  planOpenAI(6);
  const env = liveEnv({ WALLET_AI_EVAL_DB: evalDb });
  const runs = await Promise.all([1, 2, 3].map(() => runEvaluator({ args: ['--live', '--limit', '2'], env, fakeUrl: openaiUrl })));
  const total = openai.requests.length;
  assert.ok(total <= 5, `${total} requests: ${runs.map((r) => r.out).join('\n---\n')}`);
  assert.equal(rowsIn(evalDb), total, 'every request had a reservation and every reservation a dispatch');
  assert.equal(runs.reduce((s, r) => s + (callsAttempted(r.out) || 0), 0), total);
  const refusals = runs.filter((r) => /evaluation rate limit|EVAL_WINDOW_FULL/.test(r.out)).length;
  assert.ok(refusals >= 1, 'six planned calls cannot all fit');
  for (const r of runs) {
    const p = reportPaths(r.out);
    if (p) {
      fs.rmSync(p.json, { force: true });
      fs.rmSync(p.md, { force: true });
    }
  }
});

test('W10 · the slot is taken at dispatch: when another process fills the window mid-run, the next call is refused before its request and the run stops INCOMPLETE', async () => {
  const evalDb = evalDbAt('w10');
  const recent = Date.now() - MIN;
  seed(evalDb, [recent, recent + 1, recent + 2]);
  openai.plan({ output: DEV[0].fixture_output, gate: 'w10' });
  openai.plan({ output: DEV[1].fixture_output });
  const pending = runEvaluator({ args: ['--live', '--limit', '2'], env: liveEnv({ WALLET_AI_EVAL_DB: evalDb }), fakeUrl: openaiUrl });
  await waitFor(() => openai.requests.length === 1, 'the first request to reach the fake');

  const other = new Database(evalDb, { timeout: 10000 });
  try {
    reserveCall(other, slot({ model: 'another-process', rowId: 'W10-OTHER' }));
  } finally {
    other.close();
    openai.openGate('w10');
  }

  const r = await pending;
  assert.equal(openai.requests.length, 1, r.out);
  assert.equal(callsAttempted(r.out), 1);
  assert.match(r.out, /RESULT=INCOMPLETE/);
  assert.match(r.out, /STOPPED: EVAL_WINDOW_FULL at \S+: 5 provider calls per rolling 10 minutes reached; next call available at \S+ \(in \d+ s\)/);
  assert.equal(rowsIn(evalDb), 5);
  const p = reportPaths(r.out);
  const report = JSON.parse(fs.readFileSync(p.json, 'utf8'));
  assert.match(report.stopped_by, /^EVAL_WINDOW_FULL at /);
  fs.rmSync(p.json, { force: true });
  fs.rmSync(p.md, { force: true });
});

test('W11 · no application database is modified: runs, refusals and a dry run in an isolated root leave its wallet.db byte-identical', async () => {
  const copy = makeWalletCopy('window-w11');
  try {
    const wallet = path.join(copy, 'data', 'wallet.db');
    fs.mkdirSync(path.dirname(wallet), { recursive: true });
    const w = new Database(wallet);
    w.exec("CREATE TABLE owner_data (x TEXT); INSERT INTO owner_data VALUES ('synthetic stand-in')");
    w.close();
    const before = sha256File(wallet);
    const sidecars = () => ['-wal', '-shm', '-journal'].map((s) => fs.existsSync(`${wallet}${s}`));
    const sidecarsBefore = sidecars();

    const env = liveEnv();   // no WALLET_AI_EVAL_DB: the default <root>/data/ai-eval.db, next to wallet.db
    planOpenAI(5);
    const run = await runEvaluator({ root: copy, args: ['--live', '--limit', '5'], env, fakeUrl: openaiUrl });
    assert.equal(callsAttempted(run.out), 5, run.out);
    const refused = await runEvaluator({ root: copy, args: ['--live', '--limit', '1'], env, fakeUrl: openaiUrl });
    assert.equal(refused.code, 3, refused.out);
    const dry = await runEvaluator({ root: copy, args: ['--live', '--dry-run'], env, fakeUrl: openaiUrl });
    assert.equal(dry.code, 0, dry.out);

    assert.equal(sha256File(wallet), before, 'wallet.db is byte-identical');
    assert.deepEqual(sidecars(), sidecarsBefore, 'no journal was opened on wallet.db');
    assert.equal(rowsIn(path.join(copy, 'data', 'ai-eval.db')), 5, 'the window lives in the evaluation database only');
    assert.equal(openai.requests.length, 5);
  } finally {
    fs.rmSync(copy, { recursive: true, force: true });
  }
});

test('W13 · the evaluator uses its own minute allowance: with the app default of 3 per minute (and even 1), --limit 5 makes all 5 calls without a minute wait; a sixth is refused by the window', async () => {
  // Found in an independent review: the evaluator took userMinute from the application's
  // pilot limits (default 3), so a --limit 5 run paused after its third call.
  for (const [name, appMinute] of [['w13-app-default', null], ['w13-app-one', '1']]) {
    openai.reset();
    const evalDb = evalDbAt(name);
    const env = liveEnv({ WALLET_AI_EVAL_DB: evalDb, WALLET_AI_EVAL_DAILY_CALLS: '5' });
    if (appMinute === null) delete env.WALLET_AI_USER_MINUTE_CALLS;   // the application default, 3 per minute
    else env.WALLET_AI_USER_MINUTE_CALLS = appMinute;

    planOpenAI(5);
    const r = await runEvaluator({ args: ['--live', '--limit', '5'], env, fakeUrl: openaiUrl });
    assert.equal(callsAttempted(r.out), 5, `${name}: ${r.out}`);
    assert.equal(openai.requests.length, 5, name);
    assert.doesNotMatch(r.out, /AI_RATE_LIMITED|STOPPED:|RESULT=INCOMPLETE/, `${name}: no minute refusal, wait or stop`);
    const p = reportPaths(r.out);
    assert.equal(JSON.parse(fs.readFileSync(p.json, 'utf8')).stopped_by, null, name);
    fs.rmSync(p.json, { force: true });
    fs.rmSync(p.md, { force: true });

    openai.reset();
    planOpenAI(1);
    const sixth = await runEvaluator({ args: ['--live', '--limit', '1'], env, fakeUrl: openaiUrl });
    assert.equal(sixth.code, 3, `${name}: ${sixth.out}`);
    const m = sixth.out.match(REFUSED);
    assert.ok(m, `${name}: ${sixth.out}`);
    assert.deepEqual(m.slice(1, 4).map(Number), [5, 0, 1], name);
    assert.equal(openai.requests.length, 0, name);
    assert.equal(rowsIn(evalDb), 5, name);
  }
});

test('W12 · the checkout\'s wallet.db, evaluation database and failed pilot report are byte-identical after this file', () => {
  assert.deepEqual(evidenceHashes(), evidenceBefore);
});

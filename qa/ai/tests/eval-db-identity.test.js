'use strict';

// N1 (independent review 2026-09-16): the live evaluator must never open an
// application database, however the path is spelled. The review opened a
// synthetic sentinel through a Windows junction: one fake call, PASS, and the
// sentinel gained a `users` table.
//
// Every database here is a synthetic sentinel in the OS temp directory. The
// default-path cases use a disposable copy of the source tree as the isolated
// root, so the owner's data/wallet.db is never a target, not even a refused one.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const { createFakeOpenAI } = require('../support/fake-openai');
const { ROOT, liveEnv, runEvaluator, callsAttempted, makeWalletCopy, sha256File, linkDirectory } = require('../support/eval-cli');

const ROWS = fs.readFileSync(path.join(ROOT, 'qa', 'ai', 'data', 'eval-cases.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const DEV = ROWS.filter((r) => r.split === 'dev');

let fake;
let fakeUrl;
let dir;
let copy;

test.before(async () => {
  fake = createFakeOpenAI();
  fakeUrl = await fake.listen();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-ai-n1-'));
  copy = makeWalletCopy('n1root');
});

test.after(async () => {
  if (fake) await fake.close();
  for (const d of [dir, copy]) if (d) fs.rmSync(d, { recursive: true, force: true });
});

test.beforeEach(() => {
  fake.reset();
  // If a refusal is missing, the evaluator gets an answer rather than hanging.
  fake.plan({ output: DEV[0].fixture_output });
});

function sentinel(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (const suffix of ['', '-wal', '-shm', '-journal']) fs.rmSync(`${file}${suffix}`, { force: true });
  const db = new Database(file);
  db.exec('CREATE TABLE sentinel (id INTEGER); INSERT INTO sentinel VALUES (42)');
  db.close();
  return { file, sha256: sha256File(file) };
}

function tablesOf(file) {
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    return db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((r) => r.name);
  } finally {
    db.close();
  }
}

function assertRefused(r, s) {
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /application database/);
  assert.equal(callsAttempted(r.out), null, 'no provider call was attempted');
  assert.equal(fake.requests.length, 0, 'nothing reached the fake provider');
  if (s) {
    assert.equal(sha256File(s.file), s.sha256, 'sentinel bytes unchanged');
    assert.deepEqual(tablesOf(s.file), ['sentinel'], 'sentinel schema unchanged');
  }
}

const live = (extra) => liveEnv({ WALLET_AI_EVAL_DAILY_CALLS: '5', ...extra });

// ------------------------------------------------------------------ spelling

test('N1.1 · the same direct path is refused before any write or dispatch', async () => {
  const s = sentinel(path.join(dir, 'direct', 'owner.db'));
  const r = await runEvaluator({ args: ['--live', '--limit', '1'], env: live({ DB_PATH: s.file, WALLET_AI_EVAL_DB: s.file }), fakeUrl });
  assertRefused(r, s);
});

test('N1.2 · a relative spelling, and on Windows a different letter case, are the same file', async () => {
  const s = sentinel(path.join(dir, 'spelling', 'owner.db'));
  const relative = path.relative(ROOT, s.file);
  const r = await runEvaluator({ args: ['--live', '--limit', '1'], env: live({ DB_PATH: s.file, WALLET_AI_EVAL_DB: relative }), fakeUrl });
  assertRefused(r, s);
  if (process.platform === 'win32') {
    const upper = await runEvaluator({ args: ['--live', '--limit', '1'], env: live({ DB_PATH: s.file, WALLET_AI_EVAL_DB: s.file.toUpperCase() }), fakeUrl });
    assertRefused(upper, s);
  }
});

// ------------------------------------------------------------------- aliases

test('N1.3 · a directory alias (junction on Windows) to the application database is refused', async () => {
  const s = sentinel(path.join(dir, 'junction-app', 'owner.db'));
  const alias = path.join(dir, 'junction-alias');
  linkDirectory(path.dirname(s.file), alias);
  const r = await runEvaluator({ args: ['--live', '--limit', '1'], env: live({ DB_PATH: s.file, WALLET_AI_EVAL_DB: path.join(alias, 'owner.db') }), fakeUrl });
  assertRefused(r, s);
});

test('N1.4 · a hard link to the application database is refused', async () => {
  const s = sentinel(path.join(dir, 'hard-app', 'owner.db'));
  const link = path.join(dir, 'hard-elsewhere', 'looks-dedicated.db');
  fs.mkdirSync(path.dirname(link), { recursive: true });
  fs.linkSync(s.file, link);
  const r = await runEvaluator({ args: ['--live', '--limit', '1'], env: live({ DB_PATH: s.file, WALLET_AI_EVAL_DB: link }), fakeUrl });
  assertRefused(r, s);
});

test('N1.4b · a file symbolic link to the application database is refused', async (t) => {
  const s = sentinel(path.join(dir, 'filelink-app', 'owner.db'));
  const link = path.join(dir, 'filelink-elsewhere.db');
  try {
    fs.symlinkSync(s.file, link, 'file');
  } catch (err) {
    if (err.code === 'EPERM') return t.skip('file symbolic links need extra privilege on this Windows account; junction and hard-link cases cover aliasing');
    throw err;
  }
  const r = await runEvaluator({ args: ['--live', '--limit', '1'], env: live({ DB_PATH: s.file, WALLET_AI_EVAL_DB: link }), fakeUrl });
  assertRefused(r, s);
});

test('N1.5 · a not-yet-created application database is protected through an aliased parent', async () => {
  const appDir = path.join(dir, 'future-app');
  fs.mkdirSync(appDir);
  const alias = path.join(dir, 'future-alias');
  linkDirectory(appDir, alias);
  const future = path.join(appDir, 'future.db');
  const r = await runEvaluator({ args: ['--live', '--limit', '1'], env: live({ DB_PATH: future, WALLET_AI_EVAL_DB: path.join(alias, 'future.db') }), fakeUrl });
  assertRefused(r, null);
  assert.deepEqual(fs.readdirSync(appDir), [], 'nothing was created where the application database will live');
});

// -------------------------------------------------- default path and sidecars

test('N1.6a · the default application database (isolated root) is protected when DB_PATH is unset', async () => {
  const s = sentinel(path.join(copy, 'data', 'wallet.db'));
  const alias = path.join(dir, 'default-alias');
  linkDirectory(path.join(copy, 'data'), alias);
  const r = await runEvaluator({ root: copy, args: ['--live', '--limit', '1'], env: live({ WALLET_AI_EVAL_DB: path.join(alias, 'wallet.db') }), fakeUrl });
  assertRefused(r, s);
});

test('N1.6b · the default application database stays protected when DB_PATH points elsewhere', async () => {
  const s = sentinel(path.join(copy, 'data', 'wallet.db'));
  const r = await runEvaluator({
    root: copy,
    args: ['--live', '--limit', '1'],
    env: live({ DB_PATH: path.join(dir, 'configured-app.db'), WALLET_AI_EVAL_DB: path.join(copy, 'data', 'wallet.db') }),
    fakeUrl,
  });
  assertRefused(r, s);
});

test('N1.6c · a SQLite sidecar name of the application database is refused', async () => {
  const s = sentinel(path.join(dir, 'sidecar-app', 'owner.db'));
  for (const suffix of ['-wal', '-shm', '-journal']) {
    const r = await runEvaluator({ args: ['--live', '--limit', '1'], env: live({ DB_PATH: s.file, WALLET_AI_EVAL_DB: `${s.file}${suffix}` }), fakeUrl });
    assertRefused(r, s);
    assert.equal(fs.existsSync(`${s.file}${suffix}`), false, `${suffix} was not created`);
    fake.reset();
    fake.plan({ output: DEV[0].fixture_output });
  }
});

test('N1.6d · on Windows, an alternate data stream of the application database is refused', { skip: process.platform !== 'win32' && 'alternate data streams exist only on NTFS' }, async () => {
  const s = sentinel(path.join(dir, 'stream-app', 'owner.db'));
  const r = await runEvaluator({ args: ['--live', '--limit', '1'], env: live({ DB_PATH: s.file, WALLET_AI_EVAL_DB: `${s.file}:evaluation` }), fakeUrl });
  assertRefused(r, s);
});

// ------------------------------------------------------ the legitimate path

test('N1.7 · a distinct evaluation database works, keeps its quota, and a dry run reads it without changing it', async (t) => {
  const s = sentinel(path.join(dir, 'distinct-app', 'owner.db'));
  const evalDb = path.join(dir, 'distinct-eval', 'ai-eval.db');
  const env = live({ DB_PATH: s.file, WALLET_AI_EVAL_DB: evalDb });

  const first = await runEvaluator({ args: ['--live', '--limit', '1'], env, fakeUrl });
  assert.equal(callsAttempted(first.out), 1, first.out);
  assert.equal(sha256File(s.file), s.sha256, 'the application sentinel was not touched');

  const quota = () => {
    const db = new Database(evalDb, { readonly: true, fileMustExist: true });
    try {
      return db.prepare("SELECT COALESCE(SUM(count), 0) AS n FROM ai_quota WHERE scope = 'global-day' AND user_id = 0").get().n;
    } finally {
      db.close();
    }
  };
  assert.equal(quota(), 1);

  fake.reset();
  const sidecarsBefore = fs.readdirSync(path.dirname(evalDb)).sort();
  const mainBefore = sha256File(evalDb);
  const dry = await runEvaluator({ args: ['--live', '--dry-run'], env, fakeUrl });
  assert.equal(dry.code, 0, dry.out);
  assert.match(dry.out, /4 left today/, 'the dry run read the existing allowance');
  assert.equal(fake.requests.length, 0);
  assert.equal(sha256File(evalDb), mainBefore, 'dry run left the evaluation database bytes unchanged');
  assert.equal(quota(), 1, 'dry run reserved nothing');
  t.diagnostic(`evaluation DB directory before dry run: ${sidecarsBefore.join(', ')}; after: ${fs.readdirSync(path.dirname(evalDb)).sort().join(', ')}`);

  fake.plan({ output: DEV[1].fixture_output });
  const second = await runEvaluator({ args: ['--live', '--limit', '1'], env, fakeUrl });
  assert.equal(callsAttempted(second.out), 1, second.out);
  assert.equal(quota(), 2, 'the allowance persisted across runs');
  assert.equal(sha256File(s.file), s.sha256);
});

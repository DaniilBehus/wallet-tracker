'use strict';

// N2 (independent review 2026-09-16): the holdout rule must follow the rows a live
// run actually sends, not how the split argument is spelled. The review ran
// `--split all --limit 94`, reached AI-EVAL-061 (the first holdout row), got
// PASS and left no ledger record; `--split holdout --limit 1` then ran that
// row again without a reason.
//
// Policy under test (D-039): live evaluation runs one split at a time, so
// `--split all` is refused in live mode; whenever the planned rows include a
// holdout row, one atomic reservation in the evaluation database is required
// before any dispatch; the record names the frozen corpus, the model and the
// declared versions; history is never erased. Only synthetic databases and a
// loopback fake are used.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const { createFakeOpenAI } = require('../support/fake-openai');
const { ROOT, liveEnv, runEvaluator, callsAttempted, makeWalletCopy } = require('../support/eval-cli');

const ROWS = fs.readFileSync(path.join(ROOT, 'qa', 'ai', 'data', 'eval-cases.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, 'qa', 'ai', 'data', 'manifest.json'), 'utf8'));
const HOLDOUT = ROWS.filter((r) => r.split === 'holdout');
const DEV = ROWS.filter((r) => r.split === 'dev');
const MODEL = 'fake-model-for-eval-tests';

let fake;
let fakeUrl;
let dir;

test.before(async () => {
  fake = createFakeOpenAI();
  fakeUrl = await fake.listen();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-ai-n2-'));
});

test.after(async () => {
  if (fake) await fake.close();
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

test.beforeEach(() => fake.reset());

const evalDbFor = (name) => path.join(dir, name, 'ai-eval.db');
const holdout = (extra = []) => ['--live', '--split', 'holdout', '--limit', '1', ...extra];

/** Ledger rows, or [] when there is no database or no ledger yet. */
function ledger(evalDb) {
  if (!fs.existsSync(evalDb)) return [];
  const db = new Database(evalDb, { readonly: true, fileMustExist: true });
  try {
    const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'eval_holdout_ledger'").get();
    return exists ? db.prepare('SELECT * FROM eval_holdout_ledger ORDER BY id').all() : [];
  } finally {
    db.close();
  }
}

async function waitFor(predicate, what, ms = 20000) {
  const deadline = Date.now() + ms;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 25));
  }
}

// ------------------------------------------------------------------ selection

test('N2.1 · live `--split all` is refused before any database or call, dry run included', async () => {
  const evalDb = evalDbFor('all');
  const reach = ROWS.findIndex((r) => r.split === 'holdout') + 1;
  for (const row of ROWS.slice(0, reach)) fake.plan({ output: row.fixture_output });

  const r = await runEvaluator({ args: ['--live', '--split', 'all', '--limit', String(reach)], env: liveEnv({ WALLET_AI_EVAL_DB: evalDb }), fakeUrl });
  assert.equal(fake.requests.length, 0, `the run reached the provider: ${callsAttempted(r.out)} call(s)`);
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /one split at a time/);
  assert.equal(fs.existsSync(evalDb), false, 'no evaluation database was created');

  const dry = await runEvaluator({ args: ['--live', '--split', 'all', '--dry-run'], env: liveEnv({ WALLET_AI_EVAL_DB: evalDb }), fakeUrl });
  assert.equal(dry.code, 2, dry.out);
  assert.match(dry.out, /one split at a time/);
});

test('N2.2 · a selection with no holdout row never touches the ledger', async () => {
  const evalDb = evalDbFor('dev');
  for (const row of DEV.slice(0, 2)) fake.plan({ output: row.fixture_output });
  const r = await runEvaluator({ args: ['--live', '--split', 'dev', '--limit', '2'], env: liveEnv({ WALLET_AI_EVAL_DB: evalDb }), fakeUrl });
  assert.equal(callsAttempted(r.out), 2, r.out);
  assert.deepEqual(ledger(evalDb), []);
});

// --------------------------------------------------------------- the ledger

test('N2.3 · first holdout run is recorded with corpus, model and versions; a repeat is refused; a reason reruns and keeps history', async () => {
  const evalDb = evalDbFor('direct');
  const env = liveEnv({ WALLET_AI_EVAL_DB: evalDb });

  fake.plan({ output: HOLDOUT[0].fixture_output });
  const first = await runEvaluator({ args: holdout(), env, fakeUrl });
  assert.equal(callsAttempted(first.out), 1, first.out);

  const again = await runEvaluator({ args: holdout(), env, fakeUrl });
  assert.equal(again.code, 3, again.out);
  assert.match(again.out, /HOLDOUT ALREADY RUN/);
  assert.equal(fake.requests.length, 1, 'the refused repeat made no call');

  const rows = ledger(evalDb);
  assert.equal(rows.length, 1, 'one ledger record for the first run');
  const [row] = rows;
  assert.equal(row.corpus_sha256, MANIFEST.sha256);
  assert.equal(row.holdout_ids_sha256, crypto.createHash('sha256').update(JSON.stringify([...MANIFEST.holdout_ids].sort())).digest('hex'));
  assert.equal(row.model, MODEL);
  assert.equal(JSON.parse(row.versions_json).normalizer, '2');
  assert.deepEqual(JSON.parse(row.planned_ids_json), [HOLDOUT[0].id]);
  assert.equal(row.reason, null);
  assert.equal(row.result, 'PASS');
  assert.equal(row.calls_attempted, 1);
  assert.match(row.code_manifest_sha256, /^[0-9a-f]{64}$/);

  fake.plan({ output: HOLDOUT[0].fixture_output });
  const rerun = await runEvaluator({ args: holdout(['--rerun-holdout', 'prompt v2 frozen after dev review']), env, fakeUrl });
  assert.equal(callsAttempted(rerun.out), 1, rerun.out);
  assert.deepEqual(ledger(evalDb).map((r) => r.reason), [null, 'prompt v2 frozen after dev review']);
});

test('N2.4 · two processes racing for the first holdout run: exactly one runs', async () => {
  for (let round = 1; round <= 3; round++) {
    fake.reset();
    const evalDb = evalDbFor(`race-${round}`);
    const env = liveEnv({ WALLET_AI_EVAL_DB: evalDb });
    fake.plan({ output: HOLDOUT[0].fixture_output });
    fake.plan({ output: HOLDOUT[0].fixture_output });
    const results = await Promise.all([runEvaluator({ args: holdout(), env, fakeUrl }), runEvaluator({ args: holdout(), env, fakeUrl })]);
    const ran = results.filter((r) => callsAttempted(r.out) === 1);
    const refused = results.filter((r) => r.code === 3 && /HOLDOUT ALREADY RUN/.test(r.out));
    assert.equal(fake.requests.length, 1, `round ${round}: ${results.map((r) => r.out).join('\n---\n')}`);
    assert.equal(ran.length, 1, `round ${round}`);
    assert.equal(refused.length, 1, `round ${round}`);
    assert.equal(ledger(evalDb).length, 1, `round ${round}`);
  }
});

test('N2.5 · an interrupted first attempt keeps its reservation', async () => {
  const evalDb = evalDbFor('interrupted');
  const env = liveEnv({ WALLET_AI_EVAL_DB: evalDb });
  fake.plan({ output: HOLDOUT[0].fixture_output, gate: 'hold-holdout' });

  let child;
  const pending = runEvaluator({ args: holdout(), env, fakeUrl, onChild: (c) => { child = c; } });
  await waitFor(() => fake.requests.length === 1, 'the holdout request to be dispatched');
  child.kill();
  const killed = await pending;
  assert.notEqual(killed.code, 0, 'the first attempt did not finish');
  fake.openGate('hold-holdout');

  const again = await runEvaluator({ args: holdout(), env, fakeUrl });
  assert.equal(again.code, 3, again.out);
  assert.match(again.out, /HOLDOUT ALREADY RUN/);
  assert.equal(fake.requests.length, 1, 'no second dispatch');
  const rows = ledger(evalDb);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].result, null, 'an interrupted attempt stays recorded as unfinished');
});

test('N2.6 · a provider error during the holdout run still counts as the run', async () => {
  const evalDb = evalDbFor('provider-error');
  const env = liveEnv({ WALLET_AI_EVAL_DB: evalDb });
  fake.plan({ status: 500 });
  const first = await runEvaluator({ args: holdout(), env, fakeUrl });
  assert.equal(callsAttempted(first.out), 1, first.out);
  assert.equal(first.code, 1, first.out);

  const rows = ledger(evalDb);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].result, 'FAIL');
  assert.equal(rows[0].calls_attempted, 1);

  const again = await runEvaluator({ args: holdout(), env, fakeUrl });
  assert.equal(again.code, 3, again.out);
  assert.equal(fake.requests.length, 1);
});

test('N2.7 · a holdout run that does not fit today\'s allowance is refused before it reserves anything', async () => {
  const evalDb = evalDbFor('allowance');
  for (const row of HOLDOUT.slice(0, 2)) fake.plan({ output: row.fixture_output });
  const r = await runEvaluator({ args: ['--live', '--split', 'holdout', '--limit', '2'], env: liveEnv({ WALLET_AI_EVAL_DB: evalDb, WALLET_AI_EVAL_DAILY_CALLS: '1' }), fakeUrl });
  assert.equal(fake.requests.length, 0, r.out);
  assert.equal(r.code, 3, r.out);
  assert.match(r.out, /needs 2 provider calls.*1 left/);
  assert.deepEqual(ledger(evalDb), []);
});

// ------------------------------------------------------------ old records

test('N2.8 · records from the earlier ledger are preserved and still count for their versions and model', async () => {
  const service = require(path.join(ROOT, 'src', 'ai', 'service.js'));
  const { INSTRUCTIONS } = require(path.join(ROOT, 'src', 'ai', 'prompt.js'));
  const { PROVIDER_SCHEMA } = require(path.join(ROOT, 'src', 'ai', 'contract.js'));
  const sha = (v) => crypto.createHash('sha256').update(v).digest('hex');
  const versionsKey = JSON.stringify({ ...service.VERSIONS, prompt_sha256: sha(INSTRUCTIONS), schema_sha256: sha(JSON.stringify(PROVIDER_SCHEMA)) });

  const legacyDb = (name, model) => {
    const file = evalDbFor(name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const db = new Database(file);
    db.exec('CREATE TABLE eval_holdout_runs (versions_key TEXT NOT NULL, model TEXT NOT NULL, started_at TEXT NOT NULL, reason TEXT)');
    db.prepare('INSERT INTO eval_holdout_runs VALUES (?, ?, ?, ?)').run(versionsKey, model, '2026-09-15T20:00:00.000Z', null);
    db.close();
    return file;
  };
  const legacyRows = (file) => {
    const db = new Database(file, { readonly: true });
    try { return db.prepare('SELECT * FROM eval_holdout_runs').all(); } finally { db.close(); }
  };

  const same = legacyDb('legacy-same', MODEL);
  fake.plan({ output: HOLDOUT[0].fixture_output });
  const refused = await runEvaluator({ args: holdout(), env: liveEnv({ WALLET_AI_EVAL_DB: same }), fakeUrl });
  assert.equal(refused.code, 3, refused.out);
  assert.match(refused.out, /HOLDOUT ALREADY RUN/);
  assert.equal(fake.requests.length, 0);

  const rerun = await runEvaluator({ args: holdout(['--rerun-holdout', 'first run under the new ledger']), env: liveEnv({ WALLET_AI_EVAL_DB: same }), fakeUrl });
  assert.equal(callsAttempted(rerun.out), 1, rerun.out);
  assert.equal(legacyRows(same).length, 1, 'the old record was kept');
  assert.equal(ledger(same).length, 1);

  fake.reset();
  const other = legacyDb('legacy-other-model', 'some-other-model');
  fake.plan({ output: HOLDOUT[0].fixture_output });
  const allowed = await runEvaluator({ args: holdout(), env: liveEnv({ WALLET_AI_EVAL_DB: other }), fakeUrl });
  assert.equal(callsAttempted(allowed.out), 1, allowed.out);
  assert.equal(legacyRows(other).length, 1);
});

test('N2.9 · an unrelated comment change does not grant a new first holdout run (disposable copy)', async () => {
  const copy = makeWalletCopy('n2comment');
  try {
    const evalDb = evalDbFor('comment');
    const env = liveEnv({ WALLET_AI_EVAL_DB: evalDb });
    fake.plan({ output: HOLDOUT[0].fixture_output });
    const first = await runEvaluator({ root: copy, args: holdout(), env, fakeUrl });
    assert.equal(callsAttempted(first.out), 1, first.out);

    fs.appendFileSync(path.join(copy, 'src', 'ai', 'limits.js'), '\n// unrelated comment added by the N2.9 control\n');
    const again = await runEvaluator({ root: copy, args: holdout(), env, fakeUrl });
    assert.equal(again.code, 3, again.out);
    assert.match(again.out, /HOLDOUT ALREADY RUN/);
    assert.equal(fake.requests.length, 1);
  } finally {
    fs.rmSync(copy, { recursive: true, force: true });
  }
});

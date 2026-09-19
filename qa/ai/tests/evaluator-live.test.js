'use strict';

// Safety of `npm run eval:ai:live` before anyone runs it for real
// (plan §10.3 and §15; review checklist §6 "live evaluator cannot bypass the
// application call allowance"). Findings L1–L6 of the S23 self-review.
//
// The real evaluator runs as a child process with the network guard preloaded,
// a synthetic key, and its OpenAI requests forwarded to a local fake through
// WALLET_AI_EVAL_TEST_FAKE_URL — a seam evaluate.js honours only while that
// guard is active. Nothing here can reach a real provider.

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const { createFakeOpenAI } = require('../support/fake-openai');
const { rateLimitDecision } = require('../evaluate');

const ROOT = path.join(__dirname, '..', '..', '..');
const EVALUATE = path.join(ROOT, 'qa', 'ai', 'evaluate.js');
const GUARD = path.join(ROOT, 'qa', 'ai', 'support', 'no-network.js').split(path.sep).join('/');
const ROWS = fs.readFileSync(path.join(ROOT, 'qa', 'ai', 'data', 'eval-cases.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const DEV = ROWS.filter((r) => r.split === 'dev' || r.kind !== 'nl');
const HOLDOUT = ROWS.filter((r) => r.split === 'holdout');

let fake;
let fakeUrl;
let dir;

test.before(async () => {
  fake = createFakeOpenAI();
  fakeUrl = await fake.listen();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-ai-evallive-'));
});

test.after(async () => {
  if (fake) await fake.close();
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

test.beforeEach(() => fake.reset());

const LIVE_ENV = (extra = {}) => ({
  OPENAI_API_KEY: 'sk-evallive-test-not-a-real-key',
  WALLET_AI_MODEL: 'fake-model-for-eval-tests',
  WALLET_AI_LIVE_ALLOWED: 'true',
  WALLET_AI_EVAL_LIVE: 'true',
  WALLET_AI_EVAL_DAILY_CALLS: '3',
  ...extra,
});

function runEval(args, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [EVALUATE, '--live', ...args], {
      cwd: ROOT,
      env: {
        PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP,
        NODE_OPTIONS: `--require "${GUARD}"`,
        WALLET_AI_EVAL_TEST_FAKE_URL: fakeUrl,
        WALLET_AI_EVAL_TEST_NO_WAIT: '1',
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('exit', (code) => resolve({ code, out }));
  });
}

const planRows = (rows) => { for (const r of rows) fake.plan({ output: r.fixture_output }); };
const realCalls = (out) => {
  const m = out.match(/provider calls attempted: (\d+)/);
  return m ? Number(m[1]) : null;
};

// ------------------------------------------------------------------- L5 L6

// A dry run may read an existing evaluation database read-only for today's
// count (N1.7 checks that it changes nothing); here none exists and none is made.
test('L5 · dry run makes zero calls and creates no database, even with DB_PATH set', async () => {
  const sentinel = path.join(dir, 'owner-wallet-sentinel.db');
  const evalDb = path.join(dir, 'l5-eval.db');
  const r = await runEval(['--dry-run'], LIVE_ENV({ DB_PATH: sentinel, WALLET_AI_EVAL_DB: evalDb }));
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Zero remote calls were made/);
  assert.match(r.out, /network guard: active/);
  assert.equal(fake.requests.length, 0);
  assert.equal(fs.existsSync(sentinel), false, 'the app database path was not touched');
  assert.equal(fs.existsSync(evalDb), false, 'a dry run creates no evaluation database');
});

test('L6 · the evaluation quota file may never be the application database', async () => {
  const shared = path.join(dir, 'shared.db');
  const r = await runEval(['--limit', '1'], LIVE_ENV({ DB_PATH: shared, WALLET_AI_EVAL_DB: shared }));
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /evaluation database refused: .* it must never be an application database/);
  assert.equal(fake.requests.length, 0);
  assert.equal(fs.existsSync(shared), false);
});

// ---------------------------------------------------------------------- L1

test('L1 · a live run needs its own finite allowance; raising the app pilot limits is neither needed nor used', async () => {
  const noAllowance = LIVE_ENV();
  delete noAllowance.WALLET_AI_EVAL_DAILY_CALLS;
  const r = await runEval(['--limit', '1'], { ...noAllowance, WALLET_AI_EVAL_DB: path.join(dir, 'l1a.db') });
  assert.equal(r.code, 3, r.out);
  assert.match(r.out, /LIVE NOT RUN: missing .*WALLET_AI_EVAL_DAILY_CALLS/);
  assert.equal(fake.requests.length, 0);

  for (const bad of ['0', '201', 'lots']) {
    const b = await runEval(['--limit', '1'], LIVE_ENV({ WALLET_AI_EVAL_DAILY_CALLS: bad, WALLET_AI_EVAL_DB: path.join(dir, 'l1b.db') }));
    assert.equal(b.code, 3, `${bad}: ${b.out}`);
    assert.match(b.out, /WALLET_AI_EVAL_DAILY_CALLS/);
  }
  assert.equal(fake.requests.length, 0);
});

test('L1/L2 · the allowance holds across runs and the pilot daily caps are not what counts', async () => {
  const evalDb = path.join(dir, 'l2.db');
  // Pilot caps set to 1 would stop the run after one row if the evaluator used
  // them; the evaluation allowance (3) is what must decide.
  const env = LIVE_ENV({ WALLET_AI_EVAL_DB: evalDb, WALLET_AI_GLOBAL_DAILY_CALLS: '1', WALLET_AI_USER_DAILY_CALLS: '1' });

  planRows(DEV.slice(0, 2));
  const first = await runEval(['--limit', '2'], env);
  assert.equal(realCalls(first.out), 2, first.out);
  assert.equal(fake.requests.length, 2);

  fake.reset();
  planRows(DEV.slice(0, 2));
  const second = await runEval(['--limit', '2'], env);
  assert.equal(realCalls(second.out), 1, second.out);
  assert.match(second.out, /RESULT=INCOMPLETE/);
  assert.match(second.out, /evaluation allowance/);
  assert.equal(fake.requests.length, 1, 'a new run did not get a fresh allowance');

  // L2: one synthetic user per category set, reused, so per-user counters persist.
  const db = new Database(evalDb, { readonly: true });
  const users = db.prepare("SELECT COUNT(*) AS n FROM users WHERE email LIKE 'eval-%'").get().n;
  db.close();
  assert.equal(users, 1, 'the second run reused the first run\'s synthetic user');
});

// ---------------------------------------------------------------------- L3

test('L3 · holdout runs once per frozen version; a rerun needs a written reason', async () => {
  const evalDb = path.join(dir, 'l3.db');
  const env = LIVE_ENV({ WALLET_AI_EVAL_DB: evalDb, WALLET_AI_EVAL_DAILY_CALLS: '10' });

  planRows(HOLDOUT.slice(0, 1));
  const first = await runEval(['--split', 'holdout', '--limit', '1'], env);
  assert.equal(realCalls(first.out), 1, first.out);

  fake.reset();
  const again = await runEval(['--split', 'holdout', '--limit', '1'], env);
  assert.equal(again.code, 3, again.out);
  assert.match(again.out, /HOLDOUT ALREADY RUN/);
  assert.equal(fake.requests.length, 0);

  planRows(HOLDOUT.slice(0, 1));
  const rerun = await runEval(['--split', 'holdout', '--limit', '1', '--rerun-holdout', 'prompt v2 frozen after dev review'], env);
  assert.equal(realCalls(rerun.out), 1, rerun.out);
  // The ledger moved to eval_holdout_ledger in D-039 (N2); eval-holdout.test.js covers the rest.
  const db = new Database(evalDb, { readonly: true });
  const reasons = db.prepare('SELECT reason FROM eval_holdout_ledger ORDER BY id').all().map((r) => r.reason);
  db.close();
  assert.deepEqual(reasons, [null, 'prompt v2 frozen after dev review']);
});

// ---------------------------------------------------------------------- L4

test('L4 · known and unknown token usage are reported separately', async () => {
  const evalDb = path.join(dir, 'l4.db');
  fake.plan({ output: DEV[0].fixture_output });                               // usage present
  fake.plan({ raw: { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(DEV[1].fixture_output) }] }] } }); // no usage
  // L7: billed but unusable — reasoning tokens used up the output budget.
  fake.plan({ incomplete: true, usage: { input_tokens: 50, output_tokens: 600, output_tokens_details: { reasoning_tokens: 600 } } });
  const r = await runEval(['--limit', '3'], LIVE_ENV({ WALLET_AI_EVAL_DB: evalDb }));
  assert.equal(realCalls(r.out), 3, r.out);
  assert.match(r.out, /usage: known for 2 call\(s\) \(input 170, output 640 tokens\); unknown for 1 call\(s\)/);
});

// ---------------------------------------------------------- pacing decision

test('a minute or concurrency refusal waits once; a daily refusal or a second refusal stops', () => {
  const minute = Object.assign(new Error('limited'), { code: 'AI_RATE_LIMITED', retryAfter: 42 });
  const daily = Object.assign(new Error('limited'), { code: 'AI_RATE_LIMITED', retryAfter: 30000 });
  assert.deepEqual(rateLimitDecision(minute, { waitedForThisRow: false }), { action: 'wait', seconds: 42 });
  assert.equal(rateLimitDecision(minute, { waitedForThisRow: true }).action, 'stop');
  assert.equal(rateLimitDecision(daily, { waitedForThisRow: false }).action, 'stop');
  assert.equal(rateLimitDecision(new Error('other'), { waitedForThisRow: false }), null);
});

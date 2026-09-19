'use strict';

// The evaluator's test seam (from an independent review, D-041). With
// WALLET_AI_EVAL_TEST_FAKE_URL set, the real provider adapter sends its
// request — Gemini key header included — to that URL instead of the provider.
// Two things must therefore hold before the seam is used, and a refusal must
// come before any evaluation database, report or request exists:
//
//   * the network guard is really loaded in this process — an environment
//     variable anyone can type is not proof;
//   * the URL is a plain loopback HTTP origin: http, localhost / 127.0.0.1 /
//     [::1], an explicit valid port, no credentials, path, query or fragment.
//
// Every run here uses synthetic keys and a local fake. Runs that must not have
// the guard use a loopback fake URL, so even the old behaviour cannot leave
// the machine; runs with non-loopback URLs always have the guard preloaded and
// use reserved names (.invalid, TEST-NET 192.0.2.0/24).

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createFakeGemini } = require('../support/fake-gemini');
const { ROOT, GUARD, runEvaluator, callsAttempted, reportPaths, makeWalletCopy } = require('../support/eval-cli');

const ROWS = fs.readFileSync(path.join(ROOT, 'qa', 'ai', 'data', 'eval-cases.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const DEV = ROWS.filter((r) => r.split === 'dev');
const KEY = 'gemini-seam-test-key-not-real-3c9e';
const GEMINI_EVAL = {
  WALLET_AI_PROVIDER: 'gemini', GEMINI_API_KEY: KEY, WALLET_AI_GEMINI_MODEL: 'gemini-seam-model',
  WALLET_AI_EVAL_LIVE: 'true', WALLET_AI_EVAL_DAILY_CALLS: '20', WALLET_AI_USER_MINUTE_CALLS: '100',
};
const STATE = path.join(ROOT, 'qa', 'ai', 'support', 'network-guard-state.js');

let fake;
let fakeUrl;
let port;
let copy;
let dir;

test.before(async () => {
  fake = createFakeGemini();
  fakeUrl = await fake.listen();
  port = new URL(fakeUrl).port;
  copy = makeWalletCopy('seam');
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-ai-seam-'));
});

test.after(async () => {
  await fake.close();
  fs.rmSync(copy, { recursive: true, force: true });
  fs.rmSync(dir, { recursive: true, force: true });
});

test.beforeEach(() => {
  fake.reset();
  // If a refusal is missing, the old path gets an answer instead of hanging.
  fake.plan({ output: DEV[0].fixture_output });
});

const reportsDir = () => path.join(copy, 'qa', 'reports', 'ai-eval');
const reportCount = () => (fs.existsSync(reportsDir()) ? fs.readdirSync(reportsDir()).length : 0);

function assertRefusedBeforeAnything(r, evalDb, reportsBefore, label) {
  assert.equal(fake.requests.length + fake.unplanned.length, 0, `${label}: a request reached the fake with the key header\n${r.out}`);
  assert.equal(r.code, 2, `${label}: ${r.out}`);
  assert.match(r.out, /test seam refused/, label);
  assert.equal(callsAttempted(r.out), null, `${label}: no provider call attempted`);
  assert.equal(fs.existsSync(evalDb), false, `${label}: no evaluation database`);
  assert.equal(reportCount(), reportsBefore, `${label}: no report written`);
  assert.ok(!r.out.includes(KEY), `${label}: no key in output`);
}

// ------------------------------------------------------ the guard's proof

test('T1 · a typed WALLET_NO_NETWORK_GUARD=active without the real guard does not open the test seam', async () => {
  const evalDb = path.join(dir, 't1', 'ai-eval.db');
  const before = reportCount();
  const r = await runEvaluator({
    root: copy,
    args: ['--live', '--limit', '1'],
    env: { ...GEMINI_EVAL, WALLET_AI_EVAL_DB: evalDb, WALLET_NO_NETWORK_GUARD: 'active' },
    fakeUrl,
    preloadGuard: false,
  });
  assertRefusedBeforeAnything(r, evalDb, before, 'forged marker');
  assert.match(r.out, /network guard is not active/);
});

test('T2 · the proof is process-local: only the loaded guard sets it, an environment variable never does, and undoing the guard withdraws it', () => {
  const probe = (preload, code, extraEnv = {}) => {
    const r = spawnSync(process.execPath, [...(preload ? ['--require', GUARD] : []), '-e', code], {
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...extraEnv },
      encoding: 'utf8',
    });
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(r.stdout.trim());
  };
  const read = `const s = require(${JSON.stringify(STATE)}); console.log(JSON.stringify({ active: s.isGuardActive(), env: process.env.WALLET_NO_NETWORK_GUARD || null }))`;

  assert.deepEqual(probe(false, read, { WALLET_NO_NETWORK_GUARD: 'active' }), { active: false, env: 'active' }, 'a typed variable is not proof');
  assert.deepEqual(probe(true, read), { active: true, env: null }, 'the loaded guard is proof, and it no longer writes an environment marker');
  const undone = `require('net').connect = function replaced() {}; ${read}`;
  assert.equal(probe(true, undone).active, false, 'a replaced net.connect is no longer a guarded process');
});

// ---------------------------------------------------------- the fake URL

test('T3 · a fake URL outside loopback is refused before any database, report or request (guard loaded)', async () => {
  const urls = [
    'http://example.invalid:8080',
    'http://192.0.2.10:8080',
    `http://127.0.0.1.example.invalid:${port}`,
    `http://localhost.:${port}`,
    `http://[::ffff:127.0.0.1]:${port}`,
    `https://127.0.0.1:${port}`,
    `ftp://127.0.0.1:${port}`,
    'not a url',
  ];
  for (const [i, url] of urls.entries()) {
    fake.reset();
    fake.plan({ output: DEV[0].fixture_output });
    const evalDb = path.join(dir, `t3-${i}`, 'ai-eval.db');
    const before = reportCount();
    const r = await runEvaluator({ root: copy, args: ['--live', '--limit', '1'], env: { ...GEMINI_EVAL, WALLET_AI_EVAL_DB: evalDb, WALLET_AI_EVAL_TEST_FAKE_URL: url, WALLET_AI_EVAL_TEST_NO_WAIT: '1' } });
    assertRefusedBeforeAnything(r, evalDb, before, url);
  }
});

test('T4 · credentials, a path, a query, a fragment or a missing or invalid port are refused before anything', async () => {
  const urls = [
    `http://user:pass@127.0.0.1:${port}`,
    `http://user@127.0.0.1:${port}`,
    `http://127.0.0.1:${port}/v1beta`,
    `http://127.0.0.1:${port}/?x=1`,
    `http://127.0.0.1:${port}?`,
    `http://127.0.0.1:${port}#frag`,
    'http://127.0.0.1',
    'http://127.0.0.1:0',
    'http://127.0.0.1:65536',
  ];
  for (const [i, url] of urls.entries()) {
    fake.reset();
    fake.plan({ output: DEV[0].fixture_output });
    const evalDb = path.join(dir, `t4-${i}`, 'ai-eval.db');
    const before = reportCount();
    const r = await runEvaluator({ root: copy, args: ['--live', '--limit', '1'], env: { ...GEMINI_EVAL, WALLET_AI_EVAL_DB: evalDb, WALLET_AI_EVAL_TEST_FAKE_URL: url, WALLET_AI_EVAL_TEST_NO_WAIT: '1' } });
    assertRefusedBeforeAnything(r, evalDb, before, url);
  }
});

// ---------------------------------------------------------- still allowed

test('T5 · the real guard and a plain loopback URL still reach the local fake', async () => {
  const evalDb = path.join(dir, 't5', 'ai-eval.db');
  const r = await runEvaluator({ root: copy, args: ['--live', '--limit', '1'], env: { ...GEMINI_EVAL, WALLET_AI_EVAL_DB: evalDb }, fakeUrl });
  assert.equal(r.code, 0, r.out);
  assert.equal(callsAttempted(r.out), 1, r.out);
  assert.equal(fake.requests.length, 1);
  assert.equal(fake.requests[0].apiKeyHeader, KEY);
  const report = JSON.parse(fs.readFileSync(reportPaths(r.out, copy).json, 'utf8'));
  assert.equal(report.mode, 'LIVE-TEST-SEAM');

  const { loopbackFakeBase } = require(path.join(ROOT, 'qa', 'ai', 'evaluate.js'));
  assert.equal(loopbackFakeBase(`http://127.0.0.1:${port}`), `http://127.0.0.1:${port}`);
  assert.equal(loopbackFakeBase(`http://127.0.0.1:${port}/`), `http://127.0.0.1:${port}`);
  assert.equal(loopbackFakeBase('http://localhost:5050'), 'http://localhost:5050');
  assert.equal(loopbackFakeBase('http://[::1]:5050'), 'http://[::1]:5050');
});

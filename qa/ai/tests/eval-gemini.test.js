'use strict';

// Gemini Free in the live evaluator (D-040). The real evaluator runs as a child
// process with the network guard; provider requests go to local fakes through
// WALLET_AI_EVAL_TEST_FAKE_URL. No real Gemini or OpenAI request is possible.
//
//   * no fallback between providers, and an unknown provider runs nothing;
//   * a Gemini run needs GEMINI_API_KEY, WALLET_AI_GEMINI_MODEL and the
//     evaluation's own switches — never an OpenAI key;
//   * reports and the holdout ledger name the provider, so Gemini and OpenAI
//     results can never be mixed, while existing OpenAI records keep counting;
//   * no key value reaches stdout, the JSON report or the Markdown report.

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const { createFakeGemini } = require('../support/fake-gemini');
const { createFakeOpenAI } = require('../support/fake-openai');
const { ROOT, runEvaluator, callsAttempted, reportPaths, makeWalletCopy } = require('../support/eval-cli');

const ROWS = fs.readFileSync(path.join(ROOT, 'qa', 'ai', 'data', 'eval-cases.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, 'qa', 'ai', 'data', 'manifest.json'), 'utf8'));
const DEV = ROWS.filter((r) => r.split === 'dev');
const HOLDOUT = ROWS.filter((r) => r.split === 'holdout');

const GEMINI_KEY = 'gemini-eval-test-key-not-real-77b2';
const OPENAI_KEY = 'sk-openai-eval-test-key-not-real-77b2';
const EVAL = { WALLET_AI_EVAL_LIVE: 'true', WALLET_AI_EVAL_DAILY_CALLS: '20', WALLET_AI_USER_MINUTE_CALLS: '100' };
const GEMINI = { WALLET_AI_PROVIDER: 'gemini', GEMINI_API_KEY: GEMINI_KEY, WALLET_AI_GEMINI_MODEL: 'gemini-synthetic-eval-model' };
const OPENAI = { OPENAI_API_KEY: OPENAI_KEY, WALLET_AI_MODEL: 'gpt-synthetic-eval-model', WALLET_AI_LIVE_ALLOWED: 'true' };

let gemini;
let geminiUrl;
let openai;
let openaiUrl;
let dir;

test.before(async () => {
  gemini = createFakeGemini();
  openai = createFakeOpenAI();
  geminiUrl = await gemini.listen();
  openaiUrl = await openai.listen();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-ai-gemini-eval-'));
});

test.after(async () => {
  await gemini.close();
  await openai.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test.beforeEach(() => {
  gemini.reset();
  openai.reset();
});

const evalDb = (name) => path.join(dir, name, 'ai-eval.db');
const noKeys = (text, where) => {
  assert.ok(!text.includes(GEMINI_KEY), `${where}: no Gemini key`);
  assert.ok(!text.includes(OPENAI_KEY), `${where}: no OpenAI key`);
};

test('E1 · Gemini without GEMINI_API_KEY does not run, and does not borrow a present OpenAI key', async () => {
  const env = { ...EVAL, ...OPENAI, WALLET_AI_PROVIDER: 'gemini', WALLET_AI_GEMINI_MODEL: 'gemini-synthetic-eval-model', WALLET_AI_EVAL_DB: evalDb('e1') };
  // The fake URL is the OpenAI fake: a fallback to the OpenAI adapter would land there.
  openai.plan({ output: DEV[0].fixture_output });
  const r = await runEvaluator({ args: ['--live', '--limit', '1'], env, fakeUrl: openaiUrl });
  assert.equal(openai.requests.length, 0, `fell back to OpenAI: ${r.out}`);
  assert.equal(r.code, 3, r.out);
  assert.match(r.out, /LIVE NOT RUN: missing .*GEMINI_API_KEY/);
  assert.doesNotMatch(r.out, /OPENAI_API_KEY/, 'OpenAI prerequisites are not asked for');
  noKeys(r.out, 'stdout');
});

test('E2 · an unknown provider runs nothing', async () => {
  const env = { ...EVAL, ...OPENAI, WALLET_AI_PROVIDER: 'mistral', WALLET_AI_EVAL_DB: evalDb('e2') };
  openai.plan({ output: DEV[0].fixture_output });
  const r = await runEvaluator({ args: ['--live', '--limit', '1'], env, fakeUrl: openaiUrl });
  assert.equal(openai.requests.length, 0, `ran with OpenAI: ${r.out}`);
  assert.equal(r.code, 3, r.out);
  assert.match(r.out, /LIVE NOT RUN: missing .*WALLET_AI_PROVIDER=openai\|gemini/);
});

test('E3 · a configured Gemini run reaches only the local Gemini fake; the report names provider and model, and no key leaks', async () => {
  const env = { ...EVAL, ...GEMINI, WALLET_AI_EVAL_DB: evalDb('e3') };
  gemini.plan({ output: DEV[0].fixture_output });
  const copy = makeWalletCopy('gemini-e3');
  try {
    const r = await runEvaluator({ root: copy, args: ['--live', '--limit', '1'], env, fakeUrl: geminiUrl });
    assert.equal(callsAttempted(r.out), 1, r.out);
    assert.equal(gemini.requests.length, 1);
    assert.deepEqual(gemini.stray, [], 'only the generateContent route (S31, D-044)');
    assert.equal(gemini.requests[0].apiKeyHeader, GEMINI_KEY);
    assert.equal(gemini.requests[0].model, 'gemini-synthetic-eval-model');
    assert.equal(gemini.requests[0].url, '/v1beta/models/gemini-synthetic-eval-model:generateContent');
    assert.equal(gemini.requests[0].body.store, false);
    assert.equal(openai.requests.length, 0);

    const paths = reportPaths(r.out, copy);
    assert.ok(paths, r.out);
    const jsonText = fs.readFileSync(paths.json, 'utf8');
    const md = fs.readFileSync(paths.md, 'utf8');
    const report = JSON.parse(jsonText);
    assert.equal(report.mode, 'LIVE-TEST-SEAM');
    assert.equal(report.provider.id, 'gemini');
    assert.equal(report.provider.model, 'gemini-synthetic-eval-model');
    assert.equal(report.provider.real_provider_requests, 0);
    assert.equal(report.provider.local_fake_requests, 1);
    assert.match(md, /Provider: Gemini adapter → local fake \(gemini\); model gemini-synthetic-eval-model/);
    assert.doesNotMatch(md, /undefined|NaN/);
    noKeys(r.out, 'stdout');
    noKeys(jsonText, 'JSON report');
    noKeys(md, 'Markdown report');
  } finally {
    fs.rmSync(copy, { recursive: true, force: true });
  }
});

test('E4 · the holdout ledger keeps Gemini and OpenAI apart, even for the same model name; OpenAI identities are unchanged', async () => {
  const db = evalDb('e4');
  const same = 'shared-model-name';
  const openaiEnv = { ...EVAL, ...OPENAI, WALLET_AI_MODEL: same, WALLET_AI_EVAL_DB: db };
  const geminiEnv = { ...EVAL, ...GEMINI, WALLET_AI_GEMINI_MODEL: same, WALLET_AI_EVAL_DB: db };
  const holdout = ['--live', '--split', 'holdout', '--limit', '1'];

  openai.plan({ output: HOLDOUT[0].fixture_output });
  const first = await runEvaluator({ args: holdout, env: openaiEnv, fakeUrl: openaiUrl });
  assert.equal(callsAttempted(first.out), 1, first.out);

  gemini.plan({ output: HOLDOUT[0].fixture_output });
  const second = await runEvaluator({ args: holdout, env: geminiEnv, fakeUrl: geminiUrl });
  assert.equal(callsAttempted(second.out), 1, `a Gemini holdout run was blocked by the OpenAI record: ${second.out}`);
  assert.equal(gemini.requests.length, 1);

  const again = await runEvaluator({ args: holdout, env: geminiEnv, fakeUrl: geminiUrl });
  assert.equal(again.code, 3, again.out);
  assert.match(again.out, /HOLDOUT ALREADY RUN/);

  const read = new Database(db, { readonly: true });
  const rows = read.prepare('SELECT provider, model, run_key, versions_json, corpus_sha256, corpus_version, holdout_ids_sha256 FROM eval_holdout_ledger ORDER BY id').all();
  read.close();
  assert.deepEqual(rows.map((r) => [r.provider, r.model]), [['openai', same], ['gemini', same]]);
  assert.notEqual(rows[0].run_key, rows[1].run_key);

  // The OpenAI key is the S24 formula exactly, so records made before D-040 still match.
  const o = rows[0];
  const s24 = crypto.createHash('sha256').update(JSON.stringify({
    corpus_sha256: MANIFEST.sha256, corpus_version: String(MANIFEST.version), holdout_ids_sha256: o.holdout_ids_sha256, model: same, versions: JSON.parse(o.versions_json),
  })).digest('hex');
  assert.equal(o.run_key, s24);
});

test('E5 · the Gemini dry run says synthetic-only, where the limits are, and calls nothing', async () => {
  const env = { ...EVAL, ...GEMINI, WALLET_AI_EVAL_DB: evalDb('e5') };
  const r = await runEvaluator({ args: ['--live', '--dry-run'], env, fakeUrl: geminiUrl });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /provider: gemini/);
  assert.match(r.out, /synthetic corpus only/);
  assert.match(r.out, /Google AI Studio/);
  assert.match(r.out, /network guard: active/);
  assert.equal(gemini.requests.length + openai.requests.length, 0);
  assert.equal(fs.existsSync(evalDb('e5')), false);
  noKeys(r.out, 'stdout');
});

test('E6 · a ledger created before D-040 (no provider column) keeps blocking OpenAI and never blocks Gemini', async () => {
  const db = evalDb('e6');
  fs.mkdirSync(path.dirname(db), { recursive: true });
  const service = require(path.join(ROOT, 'src', 'ai', 'service.js'));
  const { INSTRUCTIONS } = require(path.join(ROOT, 'src', 'ai', 'prompt.js'));
  const { PROVIDER_SCHEMA } = require(path.join(ROOT, 'src', 'ai', 'contract.js'));
  const sha = (v) => crypto.createHash('sha256').update(v).digest('hex');
  const versions = { ...service.VERSIONS, prompt_sha256: sha(INSTRUCTIONS), schema_sha256: sha(JSON.stringify(PROVIDER_SCHEMA)) };
  const same = 'shared-model-name';
  const holdoutIds = sha(JSON.stringify([...MANIFEST.holdout_ids].sort()));
  const s24Key = sha(JSON.stringify({ corpus_sha256: MANIFEST.sha256, corpus_version: String(MANIFEST.version), holdout_ids_sha256: holdoutIds, model: same, versions }));

  const setup = new Database(db);
  setup.exec(`CREATE TABLE eval_holdout_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT, run_key TEXT NOT NULL, corpus_sha256 TEXT NOT NULL, corpus_version TEXT NOT NULL,
    holdout_ids_sha256 TEXT NOT NULL, model TEXT NOT NULL, versions_json TEXT NOT NULL, code_manifest_sha256 TEXT NOT NULL,
    planned_ids_json TEXT NOT NULL, reason TEXT, started_at TEXT NOT NULL, finished_at TEXT, result TEXT, calls_attempted INTEGER)`);
  setup.prepare(`INSERT INTO eval_holdout_ledger (run_key, corpus_sha256, corpus_version, holdout_ids_sha256, model, versions_json, code_manifest_sha256, planned_ids_json, started_at, finished_at, result, calls_attempted)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(s24Key, MANIFEST.sha256, String(MANIFEST.version), holdoutIds, same, JSON.stringify(versions), 'a'.repeat(64), JSON.stringify([HOLDOUT[0].id]), '2026-09-16T09:00:00.000Z', '2026-09-16T09:00:05.000Z', 'PASS', 1);
  setup.close();

  const holdout = ['--live', '--split', 'holdout', '--limit', '1'];
  openai.plan({ output: HOLDOUT[0].fixture_output });
  const openaiRun = await runEvaluator({ args: holdout, env: { ...EVAL, ...OPENAI, WALLET_AI_MODEL: same, WALLET_AI_EVAL_DB: db }, fakeUrl: openaiUrl });
  assert.equal(openaiRun.code, 3, openaiRun.out);
  assert.match(openaiRun.out, /HOLDOUT ALREADY RUN/);
  assert.equal(openai.requests.length, 0);

  gemini.plan({ output: HOLDOUT[0].fixture_output });
  const geminiRun = await runEvaluator({ args: holdout, env: { ...EVAL, ...GEMINI, WALLET_AI_GEMINI_MODEL: same, WALLET_AI_EVAL_DB: db }, fakeUrl: geminiUrl });
  assert.equal(callsAttempted(geminiRun.out), 1, geminiRun.out);

  const read = new Database(db, { readonly: true });
  const rows = read.prepare('SELECT provider, run_key FROM eval_holdout_ledger ORDER BY id').all();
  read.close();
  assert.deepEqual(rows.map((r) => r.provider), [null, 'gemini'], 'the old row is kept as it was; the column was added');
  assert.equal(rows[0].run_key, s24Key);
});

test('E8 · a non-2xx Gemini answer is reported by its numeric HTTP status only: no upstream body or header, prompt, description or key anywhere', async () => {
  // S28 (D-042): the first real pilot ended AI_PROVIDER_FAILED and its report
  // could not say why. The status is the one upstream fact worth keeping.
  const env = { ...EVAL, ...GEMINI, WALLET_AI_EVAL_DB: evalDb('e8') };
  const UPSTREAM_BODY = 'UPSTREAM-BODY-SENTINEL-e8';
  const UPSTREAM_HEADER = 'UPSTREAM-HEADER-SENTINEL-e8';
  const upstream = (status) => ({
    status,
    headers: { 'x-upstream-note': UPSTREAM_HEADER },
    body: { error: { code: 'invalid_request', message: `${UPSTREAM_BODY} ${GEMINI_KEY}` } },
  });
  gemini.plan(upstream(400));
  gemini.plan(upstream(503));
  const copy = makeWalletCopy('gemini-e8');
  try {
    const r = await runEvaluator({ root: copy, args: ['--live', '--limit', '2'], env, fakeUrl: geminiUrl });
    assert.equal(callsAttempted(r.out), 2, r.out);
    assert.equal(r.code, 1, r.out);
    const paths = reportPaths(r.out, copy);
    assert.ok(paths, r.out);
    const jsonText = fs.readFileSync(paths.json, 'utf8');
    const md = fs.readFileSync(paths.md, 'utf8');
    const report = JSON.parse(jsonText);

    assert.deepEqual(report.mismatches.map((m) => m.actual), [
      { error: 'AI_PROVIDER_FAILED', http_status: 400 },
      { error: 'AI_PROVIDER_BUSY', http_status: 503 },
    ]);
    assert.deepEqual(report.provider.http_error_statuses, { 400: 1, 503: 1 });
    assert.match(md, /^- Provider HTTP errors: 400 ×1, 503 ×1$/m);
    assert.match(md, /"http_status":400/);
    assert.match(r.out, /provider HTTP errors: 400 ×1, 503 ×1/);
    assert.doesNotMatch(md, /undefined|NaN/);

    const { INSTRUCTIONS } = require(path.join(ROOT, 'src', 'ai', 'prompt.js'));
    const texts = report.mismatches.map((m) => ROWS.find((row) => row.id === m.id).text);
    for (const [where, text] of [['stdout', r.out], ['JSON report', jsonText], ['Markdown report', md]]) {
      noKeys(text, where);
      for (const secret of [UPSTREAM_BODY, UPSTREAM_HEADER, 'invalid_request', INSTRUCTIONS.slice(0, 60), ...texts]) {
        assert.ok(!text.includes(secret), `${where}: ${secret.slice(0, 40)}`);
      }
    }
  } finally {
    fs.rmSync(copy, { recursive: true, force: true });
  }
});

test('E9 · a Gemini model id that cannot be a URL path segment is a missing prerequisite: nothing runs, nothing is requested', async () => {
  // S31 (D-044): the model id is part of the generateContent URL path, so it is
  // checked before any database, report or request.
  for (const bad of ['../gemini-2.5-flash-lite', 'gemini-2.5-flash-lite?key=x', 'gemini 2.5']) {
    const dbFile = evalDb(`e9-${bad.length}`);
    const env = { ...EVAL, ...GEMINI, WALLET_AI_GEMINI_MODEL: bad, WALLET_AI_EVAL_DB: dbFile };
    gemini.plan({ output: DEV[0].fixture_output });
    const r = await runEvaluator({ args: ['--live', '--limit', '1'], env, fakeUrl: geminiUrl });
    assert.equal(r.code, 3, `${bad}: ${r.out}`);
    assert.match(r.out, /LIVE NOT RUN: missing .*WALLET_AI_GEMINI_MODEL=<a model id such as gemini-2\.5-flash-lite>/);
    assert.equal(gemini.requests.length + gemini.stray.length, 0, bad);
    assert.equal(fs.existsSync(dbFile), false, `${bad}: no evaluation database`);
    gemini.reset();
  }
});

test('E7 · npm run test:ai removes every provider key and switch from the environment it passes on', () => {
  const { scrubbedEnv } = require('../support/test-env');
  const runner = fs.readFileSync(path.join(ROOT, 'qa', 'ai', 'run.js'), 'utf8');
  assert.match(runner, /scrubbedEnv\(process\.env\)/, 'run.js uses the shared scrubber');
  const out = scrubbedEnv({
    PATH: '/bin', GEMINI_API_KEY: GEMINI_KEY, GOOGLE_API_KEY: 'google-key-not-real', OPENAI_API_KEY: OPENAI_KEY,
    WALLET_AI_PROVIDER: 'gemini', WALLET_AI_GEMINI_MODEL: 'm', gemini_api_key: 'lower', NODE_OPTIONS: '--require x',
  });
  assert.deepEqual(out, { PATH: '/bin' });
});

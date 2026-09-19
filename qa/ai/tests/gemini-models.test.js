'use strict';

// Read-only Gemini model-list diagnostic (S31, D-044): `npm run eval:ai:models`.
//
// It may only GET /v1beta/models with the key in x-goog-api-key, show each Gemini
// model's name and whether it supports generateContent, and judge the configured
// model. It never calls generateContent or the Interactions API, never prints or
// stores the key, never keeps an upstream body or header, and writes no report or
// database. Everything here runs against a local fake with the network guard;
// the command is started directly, so no .env file is read.

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { createFakeGemini } = require('../support/fake-gemini');
const { ROOT, GUARD, makeWalletCopy } = require('../support/eval-cli');
const { GEMINI_MODELS_URL, listGeminiModels, summarizeModels, diagnose, flashCandidates, ModelListError, loopbackModelsFetch } = require('../gemini-models');

const KEY = 'gemini-models-test-key-not-real-5e1a';
const BODY_SENTINEL = 'UPSTREAM-MODELS-BODY-SENTINEL-77c1';
const HEADER_SENTINEL = 'UPSTREAM-MODELS-HEADER-SENTINEL-2b9d';

// Shape of the official models.list response (read 2026-09-17).
const PAGE_1 = [
  { name: 'models/gemini-2.5-flash', version: '001', displayName: 'Gemini 2.5 Flash', supportedGenerationMethods: ['generateContent', 'countTokens', 'createCachedContent', 'batchGenerateContent'] },
  { name: 'models/gemini-2.5-flash-lite', supportedGenerationMethods: ['generateContent', 'countTokens'] },
  { name: 'models/gemini-2.5-flash-preview-tts', supportedGenerationMethods: ['countTokens', 'generateContent'] },
  { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] },
];
const PAGE_2 = [
  { name: 'models/gemini-3.1-flash-lite', supportedGenerationMethods: ['generateContent'] },
  { name: 'models/gemini-3.1-flash-lite-preview', supportedGenerationMethods: ['generateContent'] },
  { name: 'models/gemini-2.5-flash-image', supportedGenerationMethods: ['generateContent'] },
  { name: 'models/gemini-embedding-001', supportedGenerationMethods: ['embedContent', 'countTextTokens'] },
  { name: 'models/gemini-2.0-flash-live-001', supportedGenerationMethods: ['bidiGenerateContent'] },
  { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] },
];

let fake;
let fakeUrl;

test.before(async () => {
  fake = createFakeGemini();
  fakeUrl = await fake.listen();
});

test.after(async () => {
  await fake.close();
});

test.beforeEach(() => fake.reset());

function runModels({ root = ROOT, env = {}, preloadGuard = true } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'qa', 'ai', 'gemini-models.js')], {
      cwd: root,
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
        ...(preloadGuard ? { NODE_OPTIONS: `--require "${GUARD}"` } : {}),
        NODE_PATH: path.resolve(path.dirname(require.resolve('better-sqlite3/package.json')), '..'),
        WALLET_AI_EVAL_TEST_FAKE_URL: fakeUrl,
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('error', reject);
    child.on('exit', (code) => resolve({ code, out }));
  });
}

const configured = (model) => ({ GEMINI_API_KEY: KEY, WALLET_AI_GEMINI_MODEL: model });

function assertNothingLeaks(text, where) {
  for (const secret of [KEY, BODY_SENTINEL, HEADER_SENTINEL, 'not_found']) {
    assert.ok(!text.includes(secret), `${where}: ${secret}`);
  }
}

function onlyModelListRequests() {
  assert.deepEqual(fake.stray, [], 'no other route was requested');
  assert.equal(fake.requests.length, 0, 'the Interactions route was not requested');
  for (const r of fake.modelRequests) {
    assert.equal(r.method, 'GET');
    assert.equal(r.bodyBytes, 0);
    assert.match(r.url, /^\/v1beta\/models\?pageSize=1000(&pageToken=[^&]+)?$/);
  }
}

// ------------------------------------------------------------------- parsing

test('M1 · a valid list, across pages, becomes each Gemini model name and whether it supports generateContent', async () => {
  fake.planModels({ models: PAGE_1, nextPageToken: 'page-2-token' });
  fake.planModels({ models: PAGE_2 });
  const r = await listGeminiModels({ apiKey: KEY, fetchImpl: loopbackModelsFetch(fakeUrl) });
  assert.equal(GEMINI_MODELS_URL, 'https://generativelanguage.googleapis.com/v1beta/models');
  assert.deepEqual(r.models.map((m) => [m.id, m.generateContent]), [
    ['gemini-2.5-flash', true],
    ['gemini-2.5-flash-lite', true],
    ['gemini-2.5-flash-preview-tts', true],
    ['gemini-3.1-flash-lite', true],
    ['gemini-3.1-flash-lite-preview', true],
    ['gemini-2.5-flash-image', true],
    ['gemini-embedding-001', false],
    ['gemini-2.0-flash-live-001', false],
    ['gemini-2.5-pro', true],
  ], 'only Gemini models, only name and generateContent');
  assert.deepEqual(Object.keys(r.models[0]).sort(), ['generateContent', 'id']);
  assert.equal(r.requests, 2);
  assert.equal(r.httpStatus, 200);
  assert.deepEqual(fake.modelRequests.map((q) => [q.method, q.url, q.apiKeyHeader, q.authorization, q.bodyBytes]), [
    ['GET', '/v1beta/models?pageSize=1000', KEY, null, 0],
    ['GET', '/v1beta/models?pageSize=1000&pageToken=page-2-token', KEY, null, 0],
  ], 'the key travels only in x-goog-api-key, never in the URL');
  onlyModelListRequests();
});

test('M2 · a configured model that is not listed is "configured model is unavailable for this key"; candidates are listed, never selected', () => {
  const models = summarizeModels([...PAGE_1, ...PAGE_2]);
  const d = diagnose({ models, configuredModel: 'gemini-9.9-flash-lite' });
  assert.deepEqual(d, { verdict: 'UNAVAILABLE', configured: 'gemini-9.9-flash-lite', message: 'configured model is unavailable for this key: gemini-9.9-flash-lite' });
  assert.deepEqual(flashCandidates(models), ['gemini-3.1-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'],
    'stable Flash/Flash-Lite with generateContent, newest first: no preview, tts, image, live or embedding');
  assert.equal(diagnose({ models, configuredModel: ' models/gemini-2.5-flash-lite ' }).verdict, 'AVAILABLE', 'a models/ prefix and spaces name the same model');
  assert.deepEqual(diagnose({ models, configuredModel: 'gemini-2.5-flash-lite' }), {
    verdict: 'AVAILABLE', configured: 'gemini-2.5-flash-lite', message: 'configured model is available for this key and supports generateContent: gemini-2.5-flash-lite',
  });
  assert.equal(diagnose({ models, configuredModel: 'gemini-2.5-flash-lit' }).verdict, 'UNAVAILABLE', 'no prefix or fuzzy match');
});

test('M3 · a listed model without generateContent is a clear unsupported-method result', () => {
  const models = summarizeModels([...PAGE_1, ...PAGE_2]);
  assert.deepEqual(diagnose({ models, configuredModel: 'gemini-2.0-flash-live-001' }), {
    verdict: 'UNSUPPORTED_METHOD',
    configured: 'gemini-2.0-flash-live-001',
    message: 'configured model is available for this key but does not support generateContent: gemini-2.0-flash-live-001',
  });
  assert.equal(diagnose({ models, configuredModel: 'gemini-embedding-001' }).verdict, 'UNSUPPORTED_METHOD');
});

test('M4 · 404, 401, 403, 500 and a redirect give the numeric status only; malformed or oversized lists are unusable; no body, header or key leaks', async () => {
  const fetchImpl = loopbackModelsFetch(fakeUrl);
  for (const status of [404, 401, 403, 500]) {
    fake.planModels({ status, headers: { 'x-upstream-note': HEADER_SENTINEL }, body: { error: { code: 'not_found', message: `${BODY_SENTINEL} for ${KEY}` } } });
    await assert.rejects(listGeminiModels({ apiKey: KEY, fetchImpl }), (e) => {
      assert.ok(e instanceof ModelListError, `${status}: ${e && e.name}`);
      assert.equal(e.kind, 'HTTP_STATUS');
      assert.strictEqual(e.httpStatus, status);
      assert.equal(e.message, `model list request failed: HTTP ${status}`);
      assert.deepEqual(Object.keys(e).sort(), ['httpStatus', 'kind', 'name']);
      assertNothingLeaks(`${e.message} ${JSON.stringify(e)} ${e.stack}`, String(status));
      return true;
    });
  }
  fake.planModels({ redirect: true });
  await assert.rejects(listGeminiModels({ apiKey: KEY, fetchImpl }), (e) => e.kind === 'HTTP_STATUS' && e.httpStatus === 302);

  const unusable = [
    { raw: 'not json at all' },
    { raw: [] },
    { raw: { models: 'gemini-2.5-flash-lite' } },
    { raw: { models: [{ name: 5 }] } },
    { raw: { models: [{ name: 'gemini-2.5-flash-lite', supportedGenerationMethods: ['generateContent'] }] } },
    { raw: { models: [{ name: 'models/gemini-2.5-flash-lite', supportedGenerationMethods: 'generateContent' }] } },
    { raw: { models: [], nextPageToken: 7 } },
    { raw: 'x'.repeat(2 * 1024 * 1024 + 10) },
  ];
  for (const step of unusable) {
    fake.planModels(step);
    await assert.rejects(listGeminiModels({ apiKey: KEY, fetchImpl }), (e) => {
      assert.equal(e.kind, 'INVALID_RESPONSE', JSON.stringify(step).slice(0, 60));
      assert.equal('httpStatus' in e, false);
      assert.equal(e.message, 'model list response could not be used');
      return true;
    });
  }

  const broken = async () => { throw new TypeError(`fetch failed for ${KEY}`); };
  await assert.rejects(listGeminiModels({ apiKey: KEY, fetchImpl: broken }), (e) => {
    assert.equal(e.kind, 'NO_HTTP_ANSWER');
    assert.equal('httpStatus' in e, false);
    assertNothingLeaks(`${e.message} ${JSON.stringify(e)} ${e.stack}`, 'network failure');
    return true;
  });
  onlyModelListRequests();
});

// ----------------------------------------------------------------------- CLI

test('M5 · the command prints the endpoint, status, configured model, each name with generateContent yes/no and the verdict — never the key', async () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['eval:ai:models'], 'node --env-file-if-exists=.env qa/ai/gemini-models.js');

  fake.planModels({ models: PAGE_1 });
  const r = await runModels({ env: configured('gemini-2.5-flash-lite') });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /^endpoint: GET https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models$/m);
  assert.match(r.out, /^HTTP status: 200 \(1 request\)$/m);
  assert.match(r.out, /^configured model: gemini-2\.5-flash-lite$/m);
  assert.match(r.out, /^ {2}gemini-2\.5-flash-lite · generateContent: yes$/m);
  assert.match(r.out, /^ {2}gemini-2\.5-flash-preview-tts · generateContent: yes$/m);
  assert.doesNotMatch(r.out, /embedding-001 ·/, 'non-Gemini models are not shown');
  assert.match(r.out, /^RESULT: AVAILABLE — configured model is available for this key and supports generateContent: gemini-2\.5-flash-lite$/m);
  assertNothingLeaks(r.out, 'stdout');
  assert.equal(fake.modelRequests.length, 1);
  onlyModelListRequests();
});

test('M6 · the command\'s other verdicts: unavailable (exit 4, candidates not selected), unsupported method (exit 5), list failed with the status only (exit 6)', async () => {
  fake.planModels({ models: [...PAGE_1, ...PAGE_2] });
  const absent = await runModels({ env: configured('gemini-9.9-flash-lite') });
  assert.equal(absent.code, 4, absent.out);
  assert.match(absent.out, /^RESULT: UNAVAILABLE — configured model is unavailable for this key: gemini-9\.9-flash-lite$/m);
  assert.match(absent.out, /^non-preview Flash\/Flash-Lite models supporting generateContent \(not selected; the operator decides\): gemini-3\.1-flash-lite, gemini-2\.5-flash-lite, gemini-2\.5-flash$/m);

  fake.planModels({ models: [...PAGE_1, ...PAGE_2] });
  const unsupported = await runModels({ env: configured('gemini-2.0-flash-live-001') });
  assert.equal(unsupported.code, 5, unsupported.out);
  assert.match(unsupported.out, /^RESULT: UNSUPPORTED_METHOD — configured model is available for this key but does not support generateContent: gemini-2\.0-flash-live-001$/m);

  for (const status of [404, 401]) {
    fake.planModels({ status, headers: { 'x-upstream-note': HEADER_SENTINEL }, body: { error: { code: 'not_found', message: `${BODY_SENTINEL} ${KEY}` } } });
    const failed = await runModels({ env: configured('gemini-2.5-flash-lite') });
    assert.equal(failed.code, 6, failed.out);
    assert.match(failed.out, new RegExp(`^HTTP status: ${status}$`, 'm'));
    assert.match(failed.out, new RegExp(`^RESULT: LIST_FAILED — model list request failed: HTTP ${status}$`, 'm'));
    assertNothingLeaks(failed.out, `stdout ${status}`);
  }

  fake.planModels({ raw: '{"models": "broken"' });
  const malformed = await runModels({ env: configured('gemini-2.5-flash-lite') });
  assert.equal(malformed.code, 6, malformed.out);
  assert.match(malformed.out, /^HTTP status: none$/m);
  assert.match(malformed.out, /^RESULT: LIST_FAILED — model list response could not be used$/m);
  onlyModelListRequests();
});

function snapshot(dir) {
  const out = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else out.push(`${path.relative(dir, p)} ${crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}`);
    }
  };
  walk(dir);
  return out.sort();
}

test('M7 · the command cannot reach generateContent or Interactions and writes nothing: no report, database or other file in an isolated root', async () => {
  const copy = makeWalletCopy('gemini-models-m7');
  try {
    const before = snapshot(copy);
    fake.planModels({ models: PAGE_1 });
    const ok = await runModels({ root: copy, env: configured('gemini-2.5-flash-lite') });
    assert.equal(ok.code, 0, ok.out);
    fake.planModels({ status: 404 });
    const failed = await runModels({ root: copy, env: configured('gemini-2.5-flash-lite') });
    assert.equal(failed.code, 6, failed.out);
    fake.planModels({ models: PAGE_1 });
    const absent = await runModels({ root: copy, env: configured('gemini-9.9-flash-lite') });
    assert.equal(absent.code, 4, absent.out);

    assert.deepEqual(snapshot(copy), before, 'not one file created or changed');
    assert.equal(fs.existsSync(path.join(copy, 'data')), false, 'no database directory');
    assert.equal(fs.existsSync(path.join(copy, 'qa', 'reports')), false, 'no report directory');
    assert.equal(fake.modelRequests.length, 3);
    onlyModelListRequests();
  } finally {
    fs.rmSync(copy, { recursive: true, force: true });
  }

  // The module holds no generation route and loads no database, adapter or evaluator runner.
  const source = fs.readFileSync(path.join(ROOT, 'qa', 'ai', 'gemini-models.js'), 'utf8');
  for (const forbidden of [':generateContent', '/interactions', "'POST'", 'writeFile', 'mkdir', 'appendFile', 'better-sqlite3']) {
    assert.ok(!source.includes(forbidden), `gemini-models.js contains ${forbidden}`);
  }
  const required = [...source.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(required)].sort(), ['./evaluate', './support/network-guard-state'], 'only the loopback check and the guard proof are loaded');
});

test('M8 · without GEMINI_API_KEY or WALLET_AI_GEMINI_MODEL nothing is requested; an OpenAI key never substitutes; the test seam needs the real guard', async () => {
  const noKey = await runModels({ env: { WALLET_AI_GEMINI_MODEL: 'gemini-2.5-flash-lite', OPENAI_API_KEY: 'sk-models-test-not-a-real-key' } });
  assert.equal(noKey.code, 3, noKey.out);
  assert.match(noKey.out, /^NOT RUN: missing GEMINI_API_KEY$/m);

  const noModel = await runModels({ env: { GEMINI_API_KEY: KEY } });
  assert.equal(noModel.code, 3, noModel.out);
  assert.match(noModel.out, /^NOT RUN: missing WALLET_AI_GEMINI_MODEL$/m);
  assertNothingLeaks(noModel.out, 'no model');

  const unguarded = await runModels({ env: configured('gemini-2.5-flash-lite'), preloadGuard: false });
  assert.equal(unguarded.code, 2, unguarded.out);
  assert.match(unguarded.out, /test seam refused/);

  const notLoopback = await runModels({ env: { ...configured('gemini-2.5-flash-lite'), WALLET_AI_EVAL_TEST_FAKE_URL: 'http://example.invalid:8080' } });
  assert.equal(notLoopback.code, 2, notLoopback.out);
  assert.match(notLoopback.out, /test seam refused/);

  assert.equal(fake.modelRequests.length, 0);
  assert.deepEqual(fake.stray, []);
});

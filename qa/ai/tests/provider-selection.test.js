'use strict';

// Provider selection (D-040): WALLET_AI_PROVIDER = openai | gemini.
//
//   * The default stays exactly as before: provider openai, AI mode off.
//   * No silent fallback in either direction, and an unknown provider enables
//     nothing.
//   * Gemini Free is for synthetic evaluation only. The application never
//     builds a Gemini provider — not with a key, not with a model, not with
//     WALLET_AI_LIVE_ALLOWED=true — and says so with a fixed message.
//   * No key value ever appears in config warnings, missing lists, responses
//     or server logs.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', '..', 'src');
const { loadConfig } = require(path.join(SRC, 'ai', 'config'));
const { resolveProvider, unavailableMessage } = require(path.join(SRC, 'ai', 'provider'));
const { createFakeOpenAI } = require('../support/fake-openai');
const { startWallet, registerUser, localToday } = require('../support/wallet-server');

const GEMINI_KEY = 'gemini-key-for-tests-not-real-5d1e';
const OPENAI_KEY = 'sk-openai-key-for-selection-tests-not-real';
const OPENAI_READY = { OPENAI_API_KEY: OPENAI_KEY, WALLET_AI_MODEL: 'gpt-for-tests', WALLET_AI_LIVE_ALLOWED: 'true' };
const GEMINI_READY = { GEMINI_API_KEY: GEMINI_KEY, WALLET_AI_GEMINI_MODEL: 'gemini-for-tests' };

const draftBody = (text) => ({ text, reference_date: localToday(), locale: 'auto', consent_to_external_processing: true });
const noSecrets = (value) => {
  const text = JSON.stringify(value);
  assert.ok(!text.includes(GEMINI_KEY), 'no Gemini key value');
  assert.ok(!text.includes(OPENAI_KEY), 'no OpenAI key value');
};

// ------------------------------------------------------------------ config

test('P1 · default: provider openai, AI off, nothing enabled', () => {
  const config = loadConfig({});
  assert.equal(config.provider, 'openai');
  assert.equal(config.mode, 'off');
  assert.equal(config.liveReady, false);
  assert.equal(resolveProvider(config), null);
});

test('P2 · an unknown provider enables nothing, even with every OpenAI prerequisite present', () => {
  for (const value of ['mistral', 'open-ai', 'gemini,openai', '']) {
    const config = loadConfig({ WALLET_AI_MODE: 'live', WALLET_AI_PROVIDER: value, ...OPENAI_READY });
    if (value === '') {
      assert.equal(config.provider, 'openai', 'an empty value is the default, not a new provider');
      continue;
    }
    assert.equal(config.provider, null, value);
    assert.equal(config.liveReady, false, value);
    assert.ok(config.missing.includes('WALLET_AI_PROVIDER=openai|gemini'), value);
    assert.ok(config.warnings.some((w) => /WALLET_AI_PROVIDER/.test(w)), value);
    assert.equal(resolveProvider(config), null, `${value}: no fallback to OpenAI`);
    noSecrets({ warnings: config.warnings, missing: config.missing });
  }
});

test('P3 · gemini without GEMINI_API_KEY names what is missing, never a value', () => {
  const config = loadConfig({ WALLET_AI_MODE: 'live', WALLET_AI_PROVIDER: 'gemini', WALLET_AI_GEMINI_MODEL: 'gemini-for-tests', ...OPENAI_READY });
  assert.equal(config.provider, 'gemini');
  assert.ok(config.missing.includes('GEMINI_API_KEY'));
  assert.equal(config.missing.includes('OPENAI_API_KEY'), false, 'OpenAI prerequisites are not Gemini prerequisites');
  assert.equal(config.liveReady, false);
  noSecrets({ warnings: config.warnings, missing: config.missing });
});

test('P4 · the application never builds Gemini, whatever is configured, and never falls back to OpenAI', () => {
  const config = loadConfig({ WALLET_AI_MODE: 'live', WALLET_AI_PROVIDER: 'gemini', WALLET_AI_LIVE_ALLOWED: 'true', ...GEMINI_READY, ...OPENAI_READY });
  assert.equal(config.provider, 'gemini');
  assert.deepEqual(config.missing, [], 'every Gemini prerequisite is present');
  assert.equal(config.liveReady, false, 'present prerequisites still do not enable the app');
  assert.equal(config.blockedReason, 'GEMINI_SYNTHETIC_EVALUATION_ONLY');
  assert.equal(resolveProvider(config), null);
  assert.match(unavailableMessage(config), /synthetic evaluation only/);
  assert.match(unavailableMessage(config), /does not accept real financial records/);
  noSecrets({ warnings: config.warnings, missing: config.missing, message: unavailableMessage(config) });
});

test('P5 · openai with only a Gemini key is not ready and does not borrow it', () => {
  const config = loadConfig({ WALLET_AI_MODE: 'live', WALLET_AI_PROVIDER: 'openai', WALLET_AI_MODEL: 'gpt-for-tests', WALLET_AI_LIVE_ALLOWED: 'true', ...GEMINI_READY });
  assert.ok(config.missing.includes('OPENAI_API_KEY'));
  assert.equal(config.liveReady, false);
  assert.equal(resolveProvider(config), null);
});

test('P6 · the application module path cannot load the Gemini adapter', () => {
  const geminiPath = path.join(SRC, 'ai', 'gemini.js');
  for (const file of ['provider.js', 'config.js', 'service.js']) {
    const source = require('fs').readFileSync(path.join(SRC, 'ai', file), 'utf8');
    assert.doesNotMatch(source, /require\([^)]*gemini[^)]*\)/, `${file} does not require the Gemini adapter`);
  }
  const routes = require('fs').readFileSync(path.join(SRC, 'routes', 'ai.js'), 'utf8');
  assert.doesNotMatch(routes, /require\([^)]*gemini[^)]*\)/, 'routes/ai.js does not require the Gemini adapter');
  assert.equal(Object.keys(require.cache).includes(geminiPath), false, 'nothing required so far loaded src/ai/gemini.js');
});

// ------------------------------------------------------ the real application

test('P7 · a real server configured for Gemini: capability off, draft 503 with the fixed message, keypad works, no key in logs', async () => {
  const fake = createFakeOpenAI();
  const fakeUrl = await fake.listen();
  let wallet = null;
  try {
    // test-server.js installs the OpenAI adapter against the fake whenever a
    // fake URL is given: a fallback to it would show up as a request here.
    wallet = await startWallet({ mode: 'live', fakeUrl, env: { WALLET_AI_PROVIDER: 'gemini', WALLET_AI_LIVE_ALLOWED: 'true', ...GEMINI_READY } });
    const u = await registerUser(wallet.baseUrl, 'gemini-app');
    const caps = await u.api('GET', '/ai/capabilities');
    assert.equal(caps.status, 200);
    assert.equal(caps.data.enabled, false);
    assert.equal(caps.data.provider, null);

    const draft = await u.api('POST', '/ai/expense-draft', { body: draftBody('Lunch 9 EUR') });
    assert.equal(draft.status, 503, JSON.stringify(draft.data));
    assert.equal(draft.data.error.code, 'AI_UNAVAILABLE');
    assert.match(draft.data.error.message, /synthetic evaluation only/);
    assert.match(draft.data.error.message, /does not accept real financial records/);
    assert.equal(fake.requests.length, 0, 'no fallback to the OpenAI adapter');

    const saved = await u.api('POST', '/transactions', { body: { amount_cents: 900, category_id: u.categories[0].id } });
    assert.equal(saved.status, 201, 'manual entry is untouched');

    assert.match(wallet.output(), /WALLET_AI_PROVIDER=gemini is for synthetic evaluation only/);
    assert.ok(!wallet.output().includes(GEMINI_KEY), 'the Gemini key value is never logged');
    noSecrets({ caps: caps.data, draft: draft.data });
  } finally {
    if (wallet) await wallet.stop();
    await fake.close();
  }
});

test('P8 · a real server with an unknown provider or a Gemini key missing: 503, never 500, no fallback', async () => {
  const fake = createFakeOpenAI();
  const fakeUrl = await fake.listen();
  try {
    for (const env of [{ WALLET_AI_PROVIDER: 'mistral' }, { WALLET_AI_PROVIDER: 'gemini', WALLET_AI_GEMINI_MODEL: 'gemini-for-tests' }]) {
      const wallet = await startWallet({ mode: 'live', fakeUrl, env: { WALLET_AI_LIVE_ALLOWED: 'true', ...env } });
      try {
        // (startWallet throwing still reaches the outer finally, which closes the fake.)
        const u = await registerUser(wallet.baseUrl, 'provider-missing');
        const draft = await u.api('POST', '/ai/expense-draft', { body: draftBody('Lunch 9 EUR') });
        assert.equal(draft.status, 503, `${JSON.stringify(env)} ${JSON.stringify(draft.data)}`);
        assert.equal(draft.data.error.code, 'AI_UNAVAILABLE');
        assert.equal(fake.requests.length, 0, `${JSON.stringify(env)}: no fallback`);
      } finally {
        await wallet.stop();
      }
    }
  } finally {
    await fake.close();
  }
});

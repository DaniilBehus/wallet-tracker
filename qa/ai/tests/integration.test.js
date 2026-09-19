'use strict';

// Real HTTP integration: a real Wallet process, a fresh SQLite file, the real
// OpenAI adapter pointed at a local fake. Every test counts the user's
// transactions before and after, because AI-R01 is the property that matters
// most and it has to hold on every branch, not only the happy one.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { createFakeOpenAI } = require('../support/fake-openai');
const { startWallet, client, registerUser, localToday, countTransactions } = require('../support/wallet-server');

const TRANSPORT = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'transport-cases.json'), 'utf8')).cases;
const KEY_IN_TEST_SERVER = 'sk-test-not-a-real-key-7f3c';
const GENEROUS = {
  WALLET_AI_GLOBAL_DAILY_CALLS: '10000',
  WALLET_AI_USER_DAILY_CALLS: '1000',
  WALLET_AI_USER_MINUTE_CALLS: '100',
  WALLET_AI_MAX_CONCURRENT: '20',
};

const draftBody = (text, extra = {}) => ({
  text,
  reference_date: localToday(),
  locale: 'auto',
  consent_to_external_processing: true,
  ...extra,
});

const expectApiError = (res, status, code) => {
  assert.equal(res.status, status, JSON.stringify(res.data));
  assert.equal(res.data.error.code, code);
};

let fake;
let fakeUrl;
let wallet;
const usedDescriptions = [];
const issuedTokens = [];

test.before(async () => {
  fake = createFakeOpenAI();
  fakeUrl = await fake.listen();
  wallet = await startWallet({ mode: 'live', fakeUrl, env: GENEROUS });
});

test.after(async () => {
  if (wallet) await wallet.stop();
  if (fake) await fake.close();
});

test.beforeEach(() => fake.reset());

async function user(label) {
  const u = await registerUser(wallet.baseUrl, label);
  issuedTokens.push(u.token);
  return u;
}

async function draft(u, text, extra) {
  usedDescriptions.push(text);
  return u.api('POST', '/ai/expense-draft', { body: draftBody(text, extra) });
}

// ------------------------------------------------------------ capabilities

test('capabilities: live-mode flags and nothing secret', async () => {
  const u = await user('caps');
  const res = await u.api('GET', '/ai/capabilities');
  assert.equal(res.status, 200);
  assert.deepEqual(res.data, {
    enabled: true, mode: 'live', provider: 'OpenAI', max_input_chars: 500,
    languages: ['en', 'uk', 'sk'], requires_external_consent: true,
  });
  assert.ok(!JSON.stringify(res.data).includes(KEY_IN_TEST_SERVER));
});

test('capabilities and draft with the feature off: disabled, manual entry untouched', async () => {
  const off = await startWallet({ mode: 'off' });
  try {
    const u = await registerUser(off.baseUrl, 'off');
    assert.deepEqual((await u.api('GET', '/ai/capabilities')).data.enabled, false);
    expectApiError(await u.api('POST', '/ai/expense-draft', { body: draftBody('Lunch 9 EUR') }), 503, 'AI_UNAVAILABLE');
    const saved = await u.api('POST', '/transactions', { body: { amount_cents: 900, category_id: u.categories[0].id } });
    assert.equal(saved.status, 201, 'keypad path still saves');
  } finally {
    await off.stop();
  }
});

test('a live request with prerequisites missing is unavailable, not a crash', async () => {
  const half = await startWallet({ mode: 'live', env: { OPENAI_API_KEY: 'sk-present-but-no-model' } });
  try {
    const u = await registerUser(half.baseUrl, 'half');
    expectApiError(await u.api('POST', '/ai/expense-draft', { body: draftBody('Lunch 9 EUR') }), 503, 'AI_UNAVAILABLE');
    assert.ok(half.output().includes('missing: WALLET_AI_MODEL'));
    assert.ok(!half.output().includes('sk-present-but-no-model'), 'the key value is never logged');
  } finally {
    await half.stop();
  }
});

// ---------------------------------------------------- refused before dispatch

test('every pre-dispatch refusal makes zero provider calls and zero writes', async () => {
  const u = await user('pre');
  const anon = { api: client(wallet.baseUrl) };

  expectApiError(await anon.api('POST', '/ai/expense-draft', { body: draftBody('Lunch 9 EUR') }), 401, 'UNAUTHORIZED');
  expectApiError(await u.api('POST', '/ai/expense-draft', { body: { ...draftBody('Lunch 9 EUR'), provider: 'demo' } }), 400, 'VALIDATION_FAILED');
  expectApiError(await u.api('POST', '/ai/expense-draft', { body: draftBody('   ') }), 400, 'VALIDATION_FAILED');
  expectApiError(await u.api('POST', '/ai/expense-draft', { body: draftBody('€'.repeat(501)) }), 400, 'VALIDATION_FAILED');
  expectApiError(await u.api('POST', '/ai/expense-draft', { body: { ...draftBody('Lunch 9 EUR'), locale: 'x'.repeat(9000) } }), 400, 'VALIDATION_FAILED');
  expectApiError(await u.api('POST', '/ai/expense-draft', { raw: '{"text":' }), 400, 'VALIDATION_FAILED');
  expectApiError(await u.api('POST', '/ai/expense-draft', { body: draftBody('Lunch 9 EUR', { reference_date: localToday(3) }) }), 400, 'REFERENCE_DATE_MISMATCH');
  expectApiError(await u.api('POST', '/ai/expense-draft', { body: draftBody('Lunch 9 EUR', { consent_to_external_processing: false }) }), 403, 'AI_CONSENT_REQUIRED');
  expectApiError(await u.api('POST', '/ai/expense-draft', { body: { text: 'Lunch 9 EUR', reference_date: localToday() } }), 403, 'AI_CONSENT_REQUIRED');

  assert.equal(fake.requests.length, 0, 'no provider call on any refusal');
  assert.equal(await countTransactions(u.api), 0);
});

test('the reference date may differ from server today by one day either way', async () => {
  const u = await user('ref');
  for (const offset of [-1, 1]) {
    fake.plan({ output: { intent: 'expense', language: 'en', amount_text: '9', currency_text: 'EUR', date_text: null, category_ref: 'c0', note_text: 'Bread' } });
    const res = await draft(u, 'Bread 9 EUR', { reference_date: localToday(offset) });
    assert.equal(res.status, 200, `offset ${offset}`);
    assert.equal(res.data.draft.spent_on, localToday(offset));
  }
});

test('category context over 100 entries is 422 before any call', async () => {
  const u = await user('ctx');
  for (let i = 0; i < 91; i++) {
    const r = await u.api('POST', '/categories', { body: { name: `Synthetic ${i}`, icon: '•' } });
    assert.equal(r.status, 201);
  }
  expectApiError(await draft(u, 'Lunch 9 EUR'), 422, 'AI_CONTEXT_TOO_LARGE');
  assert.equal(fake.requests.length, 0);
});

// -------------------------------------------------------------- happy path

test('ready draft: exact values, provenance, nothing saved, private payload', async () => {
  const u = await user('happy');
  const restaurants = u.categories.find((c) => c.name === 'Restaurants');
  const refIndex = u.categories.indexOf(restaurants);
  fake.plan({ output: { intent: 'expense', language: 'uk', amount_text: '18', currency_text: 'євро', date_text: 'Учора', category_ref: `c${refIndex}`, note_text: 'обід' } });

  const res = await draft(u, 'Учора витратив 18 євро на обід');
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.equal(res.data.status, 'ready');
  assert.deepEqual(res.data.draft, { amount_cents: 1800, category_id: restaurants.id, spent_on: localToday(-1), note: 'обід' });
  assert.deepEqual(res.data.provenance, { amount: 'source', category: 'suggested', date: 'source', currency: 'source', note: 'source' });
  assert.deepEqual(res.data.issues, []);
  assert.deepEqual(res.data.versions, { schema: '1', prompt: '1', normalizer: '2' });
  assert.match(res.data.request_id, /^[0-9a-f-]{36}$/);
  assert.equal(await countTransactions(u.api), 0, 'a draft is not an expense');

  assert.equal(fake.requests.length, 1);
  const sent = fake.requests[0];
  assert.equal(sent.authorization, `Bearer ${KEY_IN_TEST_SERVER}`);
  const data = JSON.parse(sent.body.input[0].content[0].text);
  assert.equal(data.description, 'Учора витратив 18 євро на обід');
  assert.deepEqual(data.categories.map((c) => c.ref), u.categories.map((_, i) => `c${i}`));
  const serialized = JSON.stringify(sent.body);
  for (const c of u.categories) assert.ok(!serialized.includes(`"id":${c.id}`), 'no database ids leave the server');
  assert.ok(!serialized.includes(u.email), 'no e-mail');
  assert.ok(!serialized.includes(u.token), 'no JWT');
});

// ------------------------------------------------------- transport fixtures

for (const fixture of TRANSPORT) {
  test(`transport fixture ${fixture.id}`, async () => {
    const u = await user(fixture.id.toLowerCase());
    if (fixture.plan) fake.plan(fixture.plan);
    const res = await draft(u, fixture.text, fixture.reference_date ? { reference_date: fixture.reference_date } : {});
    assert.equal(res.status, fixture.expect.http, JSON.stringify(res.data));
    if (fixture.expect.code) assert.equal(res.data.error.code, fixture.expect.code);
    if (fixture.expect.status) {
      assert.equal(res.data.status, fixture.expect.status);
      assert.ok(res.data.issues.some((i) => i.code === fixture.expect.issue), JSON.stringify(res.data.issues));
      assert.deepEqual(res.data.draft, { amount_cents: null, category_id: null, spent_on: null, note: null });
    }
    if (res.status >= 400) {
      const text = JSON.stringify(res.data);
      assert.ok(!/fake upstream|unplanned|I cannot help|steal/.test(text), 'no upstream content in the error body');
    }
    assert.equal(fake.requests.length, fixture.expect.calls);
    assert.equal(await countTransactions(u.api), 0);
  });
}

// ---------------------------------------------------------------- isolation

test('user isolation: another user\'s categories never reach this user\'s provider payload', async () => {
  const a = await user('iso-a');
  const b = await user('iso-b');
  await b.api('POST', '/categories', { body: { name: 'Bs private hobby', icon: '•' } });
  fake.plan({ output: { intent: 'expense', language: 'en', amount_text: '9', currency_text: 'EUR', date_text: null, category_ref: 'c0', note_text: 'Bread' } });
  const res = await draft(a, 'Bread 9 EUR');
  assert.equal(res.status, 200);
  assert.ok(a.categories.some((c) => c.id === res.data.draft.category_id));
  assert.ok(!JSON.stringify(fake.requests[0].body).includes('Bs private hobby'));
});

// --------------------------------------------------------- limits over HTTP

test('limits: parallel users cannot pass a global daily cap together', async () => {
  const capped = await startWallet({
    mode: 'live', fakeUrl,
    env: { ...GENEROUS, WALLET_AI_GLOBAL_DAILY_CALLS: '3' },
  });
  try {
    const users = await Promise.all(Array.from({ length: 8 }, (_, i) => registerUser(capped.baseUrl, `g${i}`)));
    for (let i = 0; i < 8; i++) {
      fake.plan({ output: { intent: 'expense', language: 'en', amount_text: '9', currency_text: 'EUR', date_text: null, category_ref: 'c0', note_text: 'Bread' } });
    }
    const results = await Promise.all(users.map((u) => u.api('POST', '/ai/expense-draft', { body: draftBody('Bread 9 EUR') })));
    const ok = results.filter((r) => r.status === 200).length;
    const limited = results.filter((r) => r.status === 429);
    assert.equal(ok, 3, JSON.stringify(results.map((r) => r.status)));
    assert.equal(limited.length, 5);
    assert.ok(limited.every((r) => r.data.error.code === 'AI_RATE_LIMITED' && Number(r.headers.get('retry-after')) > 0));
    assert.equal(fake.requests.length, 3, 'refused requests never reached the provider');
  } finally {
    await capped.stop();
  }
});

test('limits: a failed attempt keeps its reservation; the minute cap then refuses', async () => {
  const slow = await startWallet({
    mode: 'live', fakeUrl,
    env: { ...GENEROUS, WALLET_AI_TIMEOUT_MS: '1000', WALLET_AI_USER_MINUTE_CALLS: '2' },
  });
  try {
    const u = await registerUser(slow.baseUrl, 'slow');
    fake.plan({ output: { intent: 'expense', language: 'en', amount_text: '9', currency_text: 'EUR', date_text: null, category_ref: 'c0', note_text: 'Bread' }, delayMs: 1800 });
    expectApiError(await u.api('POST', '/ai/expense-draft', { body: draftBody('Bread 9 EUR') }), 504, 'AI_TIMEOUT');
    fake.plan({ status: 500 });
    expectApiError(await u.api('POST', '/ai/expense-draft', { body: draftBody('Bread 9 EUR') }), 502, 'AI_PROVIDER_FAILED');
    const third = await u.api('POST', '/ai/expense-draft', { body: draftBody('Bread 9 EUR') });
    expectApiError(third, 429, 'AI_RATE_LIMITED');
    assert.equal(fake.requests.length, 2);
    assert.equal(await countTransactions(u.api), 0);
  } finally {
    await slow.stop();
  }
});

test('limits: daily counts survive a server restart on the same database', async () => {
  // The same signing secret on both runs, so the user's token stays valid.
  const env = { ...GENEROUS, WALLET_AI_USER_DAILY_CALLS: '2', JWT_SECRET: 'restart-test-secret-'.padEnd(64, 'x') };
  const first = await startWallet({ mode: 'live', fakeUrl, env });
  const u = await registerUser(first.baseUrl, 'restart');
  const plan = () => fake.plan({ output: { intent: 'expense', language: 'en', amount_text: '9', currency_text: 'EUR', date_text: null, category_ref: 'c0', note_text: 'Bread' } });
  plan(); assert.equal((await u.api('POST', '/ai/expense-draft', { body: draftBody('Bread 9 EUR') })).status, 200);
  plan(); assert.equal((await u.api('POST', '/ai/expense-draft', { body: draftBody('Bread 9 EUR') })).status, 200);
  await first.stop({ keepDatabase: true });

  const second = await startWallet({ mode: 'live', fakeUrl, env, dbPath: first.databasePath });
  try {
    const again = client(second.baseUrl, u.token);
    expectApiError(await again('POST', '/ai/expense-draft', { body: draftBody('Bread 9 EUR') }), 429, 'AI_RATE_LIMITED');
  } finally {
    await second.stop();
    fs.rmSync(path.dirname(first.databasePath), { recursive: true, force: true });
  }
});

test('limits: one request in flight per user; the slot frees when it finishes', async () => {
  const u = await user('conc');
  fake.plan({ output: { intent: 'expense', language: 'en', amount_text: '9', currency_text: 'EUR', date_text: null, category_ref: 'c0', note_text: 'Bread' }, gate: 'hold-1' });
  const first = draft(u, 'Bread 9 EUR');
  await waitFor(() => fake.requests.length === 1);
  const second = await draft(u, 'Bread 9 EUR');
  expectApiError(second, 429, 'AI_RATE_LIMITED');
  fake.openGate('hold-1');
  assert.equal((await first).status, 200);

  fake.plan({ output: { intent: 'expense', language: 'en', amount_text: '9', currency_text: 'EUR', date_text: null, category_ref: 'c0', note_text: 'Bread' } });
  assert.equal((await draft(u, 'Bread 9 EUR')).status, 200, 'slot released');
});

test('a client that disconnects releases its slot; nothing is saved', async () => {
  const u = await user('abort');
  fake.plan({ output: { intent: 'expense', language: 'en', amount_text: '9', currency_text: 'EUR', date_text: null, category_ref: 'c0', note_text: 'Bread' }, gate: 'never-opened' });
  const controller = new AbortController();
  const pending = fetch(`${wallet.baseUrl}/api/ai/expense-draft`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${u.token}` },
    body: JSON.stringify(draftBody('Bread 9 EUR')),
    signal: controller.signal,
  }).catch((e) => e);
  await waitFor(() => fake.requests.length === 1);
  controller.abort();
  await pending;

  fake.plan({ output: { intent: 'expense', language: 'en', amount_text: '9', currency_text: 'EUR', date_text: null, category_ref: 'c0', note_text: 'Bread' } });
  const next = await waitForStatus(() => draft(u, 'Bread 9 EUR'), 200);
  assert.equal(next.status, 200, 'the aborted request no longer holds the user slot');
  assert.equal(await countTransactions(u.api), 0);
});

// -------------------------------------------------------------- privacy

test('logs carry outcome codes only: no descriptions, tokens or keys', () => {
  const log = wallet.output();
  assert.ok(log.includes('"event":"ai_draft"'), 'the draft log line exists');
  for (const text of usedDescriptions) {
    if (text.trim().length > 4) assert.ok(!log.includes(text), `description leaked: ${text.slice(0, 20)}`);
  }
  for (const token of issuedTokens) assert.ok(!log.includes(token), 'a JWT leaked into the log');
  assert.ok(!log.includes(KEY_IN_TEST_SERVER), 'the provider key leaked into the log');
  assert.ok(!log.includes('UNHANDLED'), 'no provider error reached the unhandled logger');
});

// -------------------------------------------------------------- helpers

async function waitFor(predicate, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('condition not met in time');
    await new Promise((r) => setTimeout(r, 20));
  }
  return true;
}

async function waitForStatus(send, status, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await send();
    if (res.status === status || Date.now() > deadline) return res;
    await new Promise((r) => setTimeout(r, 50));
  }
}

'use strict';

// The REAL Gemini adapter (src/ai/gemini.js, D-040, D-044) against a local fake of
// the documented generateContent method. Nothing inside the adapter is mocked: it
// builds its request, sends it through fetch, streams and caps the body and parses
// the raw REST shape. Only the URL is redirected to 127.0.0.1 by an injected fetch.
//
// Every answer, success or failure, is held to the same Wallet contract as the
// OpenAI adapter: the service, contract and normaliser are shared, unchanged.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const SRC = path.join(__dirname, '..', '..', '..', 'src');
const { createGeminiProvider, geminiGenerateUrl, normalizeGeminiModel, parseGenerateContent } = require(path.join(SRC, 'ai', 'gemini'));
const { createOpenAIProvider, ProviderError, API_URL: OPENAI_API_URL, MAX_RESPONSE_BYTES } = require(path.join(SRC, 'ai', 'openai'));
const { PROVIDER_SCHEMA } = require(path.join(SRC, 'ai', 'contract'));
const { buildPrompt } = require(path.join(SRC, 'ai', 'prompt'));
const { createDraftService } = require(path.join(SRC, 'ai', 'service'));
const { createLimits } = require(path.join(SRC, 'ai', 'limits'));
const { createFakeGemini } = require('../support/fake-gemini');
const { createFakeOpenAI, forwardingFetch } = require('../support/fake-openai');

const KEY = 'gemini-adapter-test-key-not-real-a41c';
const MODEL = 'gemini-test-model';
const answer = { intent: 'expense', language: 'en', amount_text: '9', currency_text: 'EUR', date_text: null, category_ref: 'c0', note_text: 'Bread' };
const prompt = () => buildPrompt({ text: 'Bread 9 EUR', referenceDate: '2026-09-14', locale: 'en', categories: [{ ref: 'c0', name: 'Groceries' }] });

async function withFake(fn, { timeoutMs = 2000, model = MODEL } = {}) {
  const fake = createFakeGemini();
  const url = await fake.listen();
  const provider = createGeminiProvider({ apiKey: KEY, model, timeoutMs, maxOutputTokens: 600, fetchImpl: forwardingFetch(url, geminiGenerateUrl(model)) });
  const call = (extra = {}) => provider.extract({ ...prompt(), schema: PROVIDER_SCHEMA, ...extra });
  try {
    await fn({ fake, call, provider });
  } finally {
    await fake.close();
  }
}

const noKey = (e) => {
  const everything = `${e.message} ${e.detail} ${JSON.stringify(e)} ${e.stack}`;
  assert.ok(!everything.includes(KEY), 'an error never carries the key');
};

const rejectsWith = (promise, code, detail) =>
  assert.rejects(promise, (e) => {
    assert.ok(e instanceof ProviderError, `expected ProviderError, got ${e && e.name}: ${e && e.message}`);
    assert.equal(e.code, code);
    if (detail) assert.match(e.detail, detail);
    noKey(e);
    return true;
  });

const candidateWith = (parts, finishReason = 'STOP') => [{ content: { role: 'model', parts }, finishReason, index: 0 }];

// ------------------------------------------------------------------ request

test('G1 · request: POST models/{model}:generateContent, key in x-goog-api-key only, strict schema unchanged as responseJsonSchema, store false, no tools', async () => {
  await withFake(async ({ fake, call }) => {
    fake.plan({ output: answer });
    const result = await call();
    assert.deepEqual(result, { kind: 'output', output: answer, usage: { input_tokens: 120, output_tokens: 40 } });

    assert.equal(fake.requests.length, 1);
    assert.deepEqual(fake.stray, [], 'no other route, the Interactions route included');
    const { model, apiKeyHeader, authorization, url, body } = fake.requests[0];
    assert.equal(model, MODEL);
    assert.equal(apiKeyHeader, KEY);
    assert.equal(authorization, null, 'no bearer header');
    assert.equal(url, `/v1beta/models/${MODEL}:generateContent`, 'the key is never in the URL');
    assert.deepEqual(Object.keys(body).sort(), ['contents', 'generationConfig', 'store', 'systemInstruction']);
    assert.equal(body.store, false);
    assert.deepEqual(body.generationConfig, { responseMimeType: 'application/json', responseJsonSchema: PROVIDER_SCHEMA, maxOutputTokens: 600 });
    assert.equal(body.systemInstruction.parts.length, 1);
    assert.equal(typeof body.systemInstruction.parts[0].text, 'string');
    assert.ok(!body.systemInstruction.parts[0].text.includes('Bread 9 EUR'), 'the description is data, not instructions');
    assert.equal(body.contents.length, 1);
    assert.equal(body.contents[0].role, 'user');
    assert.equal(body.contents[0].parts.length, 1);
    assert.equal(JSON.parse(body.contents[0].parts[0].text).description, 'Bread 9 EUR');
  });
});

test('G2 · the adapter only ever asks for the documented model URL, never follows redirects, and needs a key and a valid model id', async () => {
  assert.equal(geminiGenerateUrl('gemini-2.5-flash-lite'), 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent');
  assert.equal(geminiGenerateUrl('models/gemini-2.5-flash-lite'), 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent');
  assert.equal(normalizeGeminiModel(' gemini-2.5-flash-lite '), 'gemini-2.5-flash-lite');
  for (const bad of ['', '   ', '../gemini', 'gemini/../x', 'gemini?key=1', 'gemini#x', 'gemini 2', 'gemini:generateContent', 'Gemini-2.5', 'models/', '-gemini']) {
    assert.equal(normalizeGeminiModel(bad), null, JSON.stringify(bad));
    assert.throws(() => geminiGenerateUrl(bad), undefined, JSON.stringify(bad));
    assert.throws(() => createGeminiProvider({ apiKey: KEY, model: bad, timeoutMs: 1000, maxOutputTokens: 600 }), undefined, JSON.stringify(bad));
  }

  const seen = [];
  const spy = async (url, init) => {
    seen.push({ url, method: init.method, redirect: init.redirect });
    return new Response(null, { status: 302, headers: { Location: 'https://example.invalid/' } });
  };
  const provider = createGeminiProvider({ apiKey: KEY, model: 'gemini-2.5-flash-lite', timeoutMs: 1000, maxOutputTokens: 600, fetchImpl: spy });
  await rejectsWith(provider.extract({ ...prompt(), schema: PROVIDER_SCHEMA }), 'AI_PROVIDER_FAILED', /redirect refused/);
  assert.deepEqual(seen, [{ url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent', method: 'POST', redirect: 'manual' }]);
  assert.throws(() => createGeminiProvider({ apiKey: '', model: 'gemini-2.5-flash-lite', timeoutMs: 1000, maxOutputTokens: 600 }));

  await withFake(async ({ fake, call }) => {
    fake.plan({ redirect: true });
    await rejectsWith(call(), 'AI_PROVIDER_FAILED', /redirect refused/);
  });
});

// ------------------------------------------------ one contract for both

function serviceWith(provider) {
  const db = new Database(':memory:');
  db.exec(fs.readFileSync(path.join(SRC, 'schema.sql'), 'utf8'));
  const userId = Number(db.prepare("INSERT INTO users (email, password_hash) VALUES ('g@wallet.test', 'x')").run().lastInsertRowid);
  const insert = db.prepare('INSERT INTO categories (user_id, name, icon) VALUES (?, ?, NULL)');
  for (const name of ['Groceries', 'Transport']) insert.run(userId, name);
  const clock = { now: () => new Date(2026, 8, 14, 12, 0, 0) };
  const logs = [];
  const service = createDraftService({
    db,
    getProvider: () => provider,
    limits: createLimits({ db, limits: { globalDaily: 100, userDaily: 100, userMinute: 100, maxConcurrent: 2, perUserConcurrent: 1 }, clock }),
    clock,
    log: (entry) => logs.push(entry),
  });
  const draft = (text) => service.createDraft({ userId, body: { text, reference_date: '2026-09-14', locale: 'en', consent_to_external_processing: true }, rawBytes: 200 });
  return { draft, logs, close: () => db.close() };
}

test('G3 · a Gemini answer becomes exactly the draft an OpenAI answer would: same contract, same normaliser', async () => {
  const gemini = createFakeGemini();
  const openai = createFakeOpenAI();
  const [gUrl, oUrl] = [await gemini.listen(), await openai.listen()];
  const g = serviceWith(createGeminiProvider({ apiKey: KEY, model: 'gm', timeoutMs: 2000, maxOutputTokens: 600, fetchImpl: forwardingFetch(gUrl, geminiGenerateUrl('gm')) }));
  const o = serviceWith(createOpenAIProvider({ apiKey: 'sk-x', model: 'om', timeoutMs: 2000, maxOutputTokens: 600, fetchImpl: forwardingFetch(oUrl, OPENAI_API_URL) }));
  try {
    gemini.plan({ output: answer });
    openai.plan({ output: answer });
    const [fromGemini, fromOpenAI] = [await g.draft('Bread 9 EUR'), await o.draft('Bread 9 EUR')];
    const comparable = (d) => ({ status: d.status, draft: d.draft, issues: d.issues, provenance: d.provenance, versions: d.versions });
    assert.deepEqual(comparable(fromGemini), comparable(fromOpenAI));
    assert.equal(fromGemini.status, 'ready');
    assert.equal(fromGemini.draft.amount_cents, 900);

    // The shared guards still decide: a foreign currency the model leaves out
    // is unsupported, a span that is not a whole token is refused, and an
    // extra key is a contract violation — through Gemini exactly as before.
    gemini.plan({ output: { ...answer, amount_text: '9', currency_text: null, note_text: null } });
    assert.equal((await g.draft('Bread 9 USD')).status, 'unsupported');
    gemini.plan({ output: { ...answer, amount_text: '18', currency_text: 'EUR', note_text: null } });
    await assert.rejects(g.draft('Lunch 180 EUR'), (e) => e.status === 502 && e.code === 'AI_INVALID_RESPONSE');
    gemini.plan({ output: { ...answer, extra: 'x' } });
    await assert.rejects(g.draft('Bread 9 EUR'), (e) => e.status === 502 && e.code === 'AI_INVALID_RESPONSE');

    const logged = JSON.stringify(g.logs);
    assert.ok(!logged.includes(KEY), 'no key in service logs');
    assert.ok(!logged.includes('Bread'), 'no description in service logs');
  } finally {
    g.close();
    o.close();
    await gemini.close();
    await openai.close();
  }
});

// -------------------------------------------------------- unusable answers

test('G4 · malformed, truncated, oversized, blocked, cut-off or multi-part answers are AI_INVALID_RESPONSE', async () => {
  const text = JSON.stringify(answer);
  const bad = [
    [{ raw: 'not json at all' }, /not JSON/],
    [{ raw: '{"candidates":[{"content":{"parts":[{"text":"{\\"intent\\":' }, /not JSON/],
    [{ raw: '[]' }, /not an object/],
    [{ output: answer, candidates: [], promptFeedback: { blockReason: 'SAFETY' } }, /prompt blocked/],
    [{ raw: { usageMetadata: { promptTokenCount: 5, totalTokenCount: 5 } } }, /exactly one candidate/],
    [{ output: answer, candidates: [...candidateWith([{ text }]), ...candidateWith([{ text: '{}' }])] }, /exactly one candidate/],
    [{ output: answer, finishReason: 'MAX_TOKENS' }, /finish reason MAX_TOKENS/],
    [{ output: answer, finishReason: 'SAFETY' }, /finish reason SAFETY/],
    [{ output: answer, candidates: [{ content: { role: 'model', parts: [{ text }] }, index: 0 }] }, /finish reason missing/],
    [{ output: answer, candidates: [{ finishReason: 'STOP', index: 0 }] }, /no content parts/],
    [{ output: answer, candidates: candidateWith([]) }, /no final text part/],
    [{ output: answer, candidates: candidateWith([{ text }, { text: '{}' }]) }, /more than one final text part/],
    [{ output: answer, candidates: candidateWith([{ text: 'thinking about bread', thought: true }]) }, /no final text part/],
    [{ output: answer, candidates: candidateWith([{ functionCall: { name: 'x', args: {} } }]) }, /unexpected part/],
    [{ output: answer, candidates: candidateWith([{ text: 'Sure! Here is the JSON' }]) }, /text is not JSON/],
    [{ hugeBytes: MAX_RESPONSE_BYTES * 2 }, /byte cap/],
  ];
  await withFake(async ({ fake, call }) => {
    for (const [step, detail] of bad) {
      fake.plan(step);
      await rejectsWith(call(), 'AI_INVALID_RESPONSE', detail);
    }
  });
});

test('G5 · usage from usageMetadata: an answer cut off at MAX_TOKENS keeps it; thought tokens are billed output', () => {
  const cut = JSON.stringify({ candidates: [{ content: { role: 'model', parts: [] }, finishReason: 'MAX_TOKENS' }], usageMetadata: { promptTokenCount: 310, thoughtsTokenCount: 600, totalTokenCount: 910 } });
  assert.throws(() => parseGenerateContent(cut), (e) => {
    assert.ok(e instanceof ProviderError);
    assert.equal(e.code, 'AI_INVALID_RESPONSE');
    assert.match(e.detail, /finish reason MAX_TOKENS/);
    assert.deepEqual(e.usage, { input_tokens: 310, output_tokens: 600, reasoning_tokens: 600 }, 'candidatesTokenCount 0 is omitted in JSON; the total decides');
    return true;
  });
  const ok = (usageMetadata) => JSON.stringify({ candidates: candidateWith([{ text: JSON.stringify(answer) }]), ...(usageMetadata ? { usageMetadata } : {}) });
  assert.deepEqual(parseGenerateContent(ok({ promptTokenCount: 7, candidatesTokenCount: 20, thoughtsTokenCount: 22, totalTokenCount: 49 })).usage, { input_tokens: 7, output_tokens: 42, reasoning_tokens: 22 });
  assert.deepEqual(parseGenerateContent(ok({ promptTokenCount: 60, candidatesTokenCount: 20, totalTokenCount: 80 })).usage, { input_tokens: 60, output_tokens: 20 });
  assert.equal(parseGenerateContent(ok(null)).usage, null, 'missing usage is unknown, not zero');
  assert.equal(parseGenerateContent(ok({ promptTokenCount: 60, candidatesTokenCount: 20 })).usage, null, 'no total: unknown');
  assert.equal(parseGenerateContent(ok({ promptTokenCount: 60, totalTokenCount: 40 })).usage, null, 'a total below the prompt is not usable');
});

// ------------------------------------------------------ transport failures

test('G6 · timeout, caller abort, 429, 503, 5xx, 4xx and a network failure map to safe codes without the key', async () => {
  await withFake(async ({ fake, call }) => {
    fake.plan({ output: answer, delayMs: 800 });
    await rejectsWith(call(), 'AI_TIMEOUT');
  }, { timeoutMs: 150 });

  await withFake(async ({ fake, call }) => {
    fake.plan({ output: answer, delayMs: 800 });
    const controller = new AbortController();
    const pending = call({ signal: controller.signal });
    setTimeout(() => controller.abort(), 50);
    await rejectsWith(pending, 'AI_PROVIDER_FAILED', /cancelled/);

    for (const [status, code] of [[429, 'AI_PROVIDER_BUSY'], [503, 'AI_PROVIDER_BUSY'], [500, 'AI_PROVIDER_FAILED'], [502, 'AI_PROVIDER_FAILED'], [400, 'AI_PROVIDER_FAILED'], [401, 'AI_PROVIDER_FAILED'], [403, 'AI_PROVIDER_FAILED']]) {
      fake.plan({ status, body: { error: { message: `upstream says the key ${KEY} is wrong` } } });
      await rejectsWith(call(), code, new RegExp(`upstream ${status}`));
    }
  });

  const broken = createGeminiProvider({ apiKey: KEY, model: MODEL, timeoutMs: 1000, maxOutputTokens: 600, fetchImpl: async () => { throw new TypeError(`fetch failed for ${KEY}`); } });
  await rejectsWith(broken.extract({ ...prompt(), schema: PROVIDER_SCHEMA }), 'AI_PROVIDER_FAILED', /network failure/);
});

test('G7 · without an injected fetch the real endpoint is unreachable from tests: the network guard refuses it', async () => {
  assert.equal(require('../support/network-guard-state').isGuardActive(), true, 'this file runs with the network guard preloaded');
  const provider = createGeminiProvider({ apiKey: KEY, model: MODEL, timeoutMs: 5000, maxOutputTokens: 600 });
  await rejectsWith(provider.extract({ ...prompt(), schema: PROVIDER_SCHEMA }), 'AI_PROVIDER_FAILED', /network failure/);
});

// -------------------------------------------- safe diagnostics (S28, D-042)

// The first real pilot (2026-09-17) ended AI_PROVIDER_FAILED with nothing that
// said why. What may be kept is the numeric HTTP status; the upstream body and
// headers may quote the request or the key and are never kept.
const UPSTREAM_BODY = 'UPSTREAM-BODY-SENTINEL-5d1e';
const UPSTREAM_HEADER = 'UPSTREAM-HEADER-SENTINEL-9b3a';
const upstreamError = (status) => ({
  status,
  headers: { 'x-upstream-note': UPSTREAM_HEADER },
  // The documented error envelope (Interactions API errors page, read 2026-09-17).
  body: { error: { code: 'invalid_request', message: `${UPSTREAM_BODY}: request for key ${KEY} with Bread 9 EUR` } },
});
const carriesNothingUpstream = (e, where) => {
  const everything = `${e.message} ${e.detail} ${JSON.stringify(e)} ${e.stack}`;
  for (const secret of [UPSTREAM_BODY, UPSTREAM_HEADER, 'invalid_request', KEY, 'Bread 9 EUR']) {
    assert.ok(!everything.includes(secret), `${where}: ${secret}`);
  }
};

test('G8 · a non-2xx answer keeps only its numeric HTTP status; never the body or the headers', async () => {
  await withFake(async ({ fake, call }) => {
    const cases = [[400, 'AI_PROVIDER_FAILED'], [401, 'AI_PROVIDER_FAILED'], [403, 'AI_PROVIDER_FAILED'], [404, 'AI_PROVIDER_FAILED'],
      [500, 'AI_PROVIDER_FAILED'], [504, 'AI_PROVIDER_FAILED'], [429, 'AI_PROVIDER_BUSY'], [503, 'AI_PROVIDER_BUSY']];
    for (const [status, code] of cases) {
      fake.plan(upstreamError(status));
      await assert.rejects(call(), (e) => {
        assert.ok(e instanceof ProviderError, `${status}: ${e && e.name}`);
        assert.equal(e.code, code);
        assert.strictEqual(e.httpStatus, status, `${status}: the numeric status is kept`);
        assert.deepEqual(Object.keys(e).sort(), ['code', 'detail', 'httpStatus', 'name'], `${status}: no other field`);
        carriesNothingUpstream(e, String(status));
        return true;
      });
    }
    fake.plan({ redirect: true });
    await assert.rejects(call(), (e) => e.code === 'AI_PROVIDER_FAILED' && e.httpStatus === 302);
  });

  // No HTTP answer, or a 2xx answer that cannot be used: there is no status to keep.
  const broken = createGeminiProvider({ apiKey: KEY, model: MODEL, timeoutMs: 1000, maxOutputTokens: 600, fetchImpl: async () => { throw new TypeError('fetch failed'); } });
  await assert.rejects(broken.extract({ ...prompt(), schema: PROVIDER_SCHEMA }), (e) => e.code === 'AI_PROVIDER_FAILED' && !('httpStatus' in e));
  await withFake(async ({ fake, call }) => {
    fake.plan({ raw: 'not json at all' });
    await assert.rejects(call(), (e) => e.code === 'AI_INVALID_RESPONSE' && !('httpStatus' in e));
  });
});

test('G9 · contract as documented on 2026-09-17 (S31): the GenerateContentResponse shape parses; the request is exactly the documented generateContent request', async () => {
  // Field names from the official models.generateContent reference:
  // GenerateContentResponse { candidates[] { content { parts[] { text }, role }, finishReason }, usageMetadata, modelVersion, responseId }.
  const documented = {
    candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }], role: 'model' }, finishReason: 'STOP', index: 0 }],
    usageMetadata: { promptTokenCount: 60, candidatesTokenCount: 20, totalTokenCount: 80, promptTokensDetails: [{ modality: 'TEXT', tokenCount: 60 }] },
    modelVersion: 'gemini-2.5-flash-lite',
    responseId: 'documented-shape',
  };
  assert.deepEqual(parseGenerateContent(JSON.stringify(documented)), { kind: 'output', output: answer, usage: { input_tokens: 60, output_tokens: 20 } });

  const seen = [];
  const spy = async (url, init) => {
    seen.push({ url, init });
    return new Response(JSON.stringify(documented), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const provider = createGeminiProvider({ apiKey: KEY, model: 'gemini-2.5-flash-lite', timeoutMs: 1000, maxOutputTokens: 600, fetchImpl: spy });
  const result = await provider.extract({ ...prompt(), schema: PROVIDER_SCHEMA });
  assert.deepEqual(result.output, answer);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent');
  assert.ok(!seen[0].url.includes('/interactions'), 'not the Interactions route');
  assert.equal(seen[0].init.method, 'POST');
  assert.deepEqual(Object.keys(seen[0].init.headers).sort(), ['Content-Type', 'x-goog-api-key']);
  const body = JSON.parse(seen[0].init.body);
  assert.deepEqual(Object.keys(body).sort(), ['contents', 'generationConfig', 'store', 'systemInstruction']);
  assert.equal('model' in body, false, 'the model is in the path, not the body');
  assert.deepEqual(body.generationConfig, { responseMimeType: 'application/json', responseJsonSchema: PROVIDER_SCHEMA, maxOutputTokens: 600 });
});

test('G10 · the application still answers only its generic error; the HTTP status stays inside the adapter error', async () => {
  const fake = createFakeGemini();
  const url = await fake.listen();
  const s = serviceWith(createGeminiProvider({ apiKey: KEY, model: 'gm', timeoutMs: 2000, maxOutputTokens: 600, fetchImpl: forwardingFetch(url, geminiGenerateUrl('gm')) }));
  try {
    fake.plan(upstreamError(400));
    await assert.rejects(s.draft('Bread 9 EUR'), (e) => {
      assert.equal(e.name, 'ApiError');
      assert.equal(e.status, 502);
      assert.equal(e.code, 'AI_PROVIDER_FAILED');
      assert.equal(e.message, 'The AI service could not be reached');
      assert.equal('httpStatus' in e, false, 'the application error carries no upstream status');
      const everything = `${e.message} ${JSON.stringify(e)}`;
      for (const secret of [UPSTREAM_BODY, UPSTREAM_HEADER, KEY, 'Bread', '400']) assert.ok(!everything.includes(secret), secret);
      return true;
    });
    assert.equal(s.logs.length, 1);
    assert.equal(s.logs[0].outcome, 'AI_PROVIDER_FAILED');
    const logged = JSON.stringify(s.logs);
    for (const secret of [UPSTREAM_BODY, UPSTREAM_HEADER, 'invalid_request', KEY, 'Bread']) assert.ok(!logged.includes(secret), `log: ${secret}`);
  } finally {
    s.close();
    await fake.close();
  }
});

// ------------------------------------------ thinking parts (S32, closes R-G1)

// Official generateContent Part reference (read 2026-09-17): `thought` "Indicates
// if the part is thought from the model"; `thoughtSignature` is an opaque
// signature; at most one data field (`text`, `inlineData`, `functionCall`, …) per
// part, beside technical fields such as `partMetadata`. The thinking guide: in
// generateContent a signature can be attached to any part, such as the final part
// of a response. So an answer may carry thought parts before its one final text
// part. The body as a whole is parsed as JSON, as any response is; what these
// tests hold the adapter to is that a thought's text is never extracted from it —
// never returned, logged or stored — and that any field outside Wallet's accepted
// set stops the row (a project policy, not an API rule).
const THOUGHT = 'THOUGHT-SENTINEL-7c2e {not json at all';
const SIGNATURE = 'U0lHTkFUVVJFLVNFTlRJTkVMLTRmOWE=';
const carriesNoThought = (value, where) => {
  const everything = typeof value === 'string' ? value : `${value && value.message} ${value && value.detail} ${JSON.stringify(value)} ${value && value.stack}`;
  for (const secret of [THOUGHT, 'THOUGHT-SENTINEL', SIGNATURE]) assert.ok(!everything.includes(secret), `${where}: ${secret}`);
};
const thinkingUsage = { promptTokenCount: 60, candidatesTokenCount: 20, thoughtsTokenCount: 30, totalTokenCount: 110 };
const thinkingUsageOut = { input_tokens: 60, output_tokens: 50, reasoning_tokens: 30 };
const answerText = JSON.stringify(answer);

test('G11 · thought parts before one final JSON text part: accepted; the thought is never extracted or returned; a signature is allowed; usage unchanged', async () => {
  const accepted = [
    ['a thought part, then the answer', [{ text: THOUGHT, thought: true }, { text: answerText }]],
    ['a thought with a signature, a signature-only thought, then the answer with a signature',
      [{ text: THOUGHT, thought: true, thoughtSignature: SIGNATURE }, { thought: true, thoughtSignature: SIGNATURE }, { text: answerText, thoughtSignature: SIGNATURE }]],
    ['a signature-only part, then the answer', [{ thoughtSignature: SIGNATURE }, { text: answerText }]],
    ['the answer marked thought: false', [{ text: THOUGHT, thought: true }, { text: answerText, thought: false }]],
    ['only the answer, with a signature', [{ text: answerText, thoughtSignature: SIGNATURE }]],
  ];
  for (const [what, parts] of accepted) {
    const result = parseGenerateContent(JSON.stringify({ candidates: candidateWith(parts), usageMetadata: thinkingUsage }));
    assert.deepEqual(result, { kind: 'output', output: answer, usage: thinkingUsageOut }, what);
    carriesNoThought(JSON.stringify(result), what);
  }

  await withFake(async ({ fake, call }) => {
    fake.plan({ output: answer, usage: thinkingUsage, candidates: candidateWith([{ text: THOUGHT, thought: true }, { text: answerText, thoughtSignature: SIGNATURE }]) });
    const result = await call();
    assert.deepEqual(result, { kind: 'output', output: answer, usage: thinkingUsageOut });
    assert.deepEqual(fake.requests[0].body.generationConfig, { responseMimeType: 'application/json', responseJsonSchema: PROVIDER_SCHEMA, maxOutputTokens: 600 }, 'the request is unchanged: no thinkingConfig is sent');
  });
});

test('G12 · still AI_INVALID_RESPONSE: thought only, two final texts, a thought after the answer, function call, media, other data, malformed parts, non-JSON text; no thought in the error; usage kept', async () => {
  const fn = { functionCall: { name: 'save_expense', args: answer } };
  const media = { inlineData: { mimeType: 'image/png', data: 'iVBORw0KGgo=' } };
  const rejected = [
    ['a thought part only', [{ text: THOUGHT, thought: true }], /no final text part/],
    ['thought parts only, with signatures', [{ text: THOUGHT, thought: true, thoughtSignature: SIGNATURE }, { thoughtSignature: SIGNATURE }], /no final text part/],
    ['no parts', [], /no final text part/],
    ['two non-thought text parts', [{ text: answerText }, { text: answerText }], /more than one final text part/],
    ['a thought, then two non-thought text parts', [{ text: THOUGHT, thought: true }, { text: answerText }, { text: '{}' }], /more than one final text part/],
    ['a thought part after the answer', [{ text: answerText }, { text: THOUGHT, thought: true }], /final text part is not last/],
    ['a function call', [fn], /unexpected part/],
    ['a thought, a function call, then the answer', [{ text: THOUGHT, thought: true }, fn, { text: answerText }], /unexpected part/],
    ['the answer, then a function call', [{ text: answerText }, fn], /unexpected part/],
    ['inline media with the answer', [media, { text: answerText }], /unexpected part/],
    ['file media with the answer', [{ fileData: { mimeType: 'image/png', fileUri: 'https://example.invalid/x.png' } }, { text: answerText }], /unexpected part/],
    ['executable code with the answer', [{ executableCode: { language: 'PYTHON', code: 'print(1)' } }, { text: answerText }], /unexpected part/],
    ['a thought part carrying a function call', [{ thought: true, ...fn }, { text: answerText }], /unexpected part/],
    ['a thought part carrying media', [{ thought: true, thoughtSignature: SIGNATURE, ...media }, { text: answerText }], /unexpected part/],
    ['text and a function call in one part', [{ text: answerText, ...fn }], /unexpected part/],
    ['a thought flag that is not a boolean', [{ text: THOUGHT, thought: 'true' }, { text: answerText }], /unexpected part/],
    ['a signature that is not a string', [{ thought: true, thoughtSignature: 7 }, { text: answerText }], /unexpected part/],
    ['a thought text that is not a string', [{ thought: true, text: { THOUGHT } }, { text: answerText }], /unexpected part/],
    ['an unknown field on the answer', [{ text: answerText, partMetadata: { source: 'x' } }], /unexpected part/],
    ['an empty part', [{}, { text: answerText }], /unexpected part/],
    ['a part that is not an object', [null, { text: answerText }], /unexpected part/],
    ['a part that is an array', [[THOUGHT], { text: answerText }], /unexpected part/],
    ['an answer text that is not a string', [{ text: answer }], /unexpected part/],
    ['a final text that is not JSON after a thought', [{ text: THOUGHT, thought: true }, { text: 'Sure! Here is the JSON' }], /text is not JSON/],
  ];
  for (const [what, parts, detail] of rejected) {
    assert.throws(() => parseGenerateContent(JSON.stringify({ candidates: candidateWith(parts), usageMetadata: thinkingUsage })), (e) => {
      assert.ok(e instanceof ProviderError, `${what}: ${e && e.name}`);
      assert.equal(e.code, 'AI_INVALID_RESPONSE', what);
      assert.match(e.detail, detail, what);
      assert.deepEqual(e.usage, thinkingUsageOut, `${what}: usage is still recorded`);
      carriesNoThought(e, what);
      return true;
    }, what);
  }
  // Thinking cut off before an answer is the finish reason, as before.
  assert.throws(() => parseGenerateContent(JSON.stringify({ candidates: candidateWith([{ text: THOUGHT, thought: true }], 'MAX_TOKENS'), usageMetadata: thinkingUsage })),
    (e) => e.code === 'AI_INVALID_RESPONSE' && /finish reason MAX_TOKENS/.test(e.detail) && (carriesNoThought(e, 'MAX_TOKENS'), true));

  await withFake(async ({ fake, call }) => {
    for (const parts of [[{ text: THOUGHT, thought: true }], [{ text: answerText }, { text: answerText }], [{ text: THOUGHT, thought: true }, fn], [media, { text: answerText }]]) {
      fake.plan({ output: answer, candidates: candidateWith(parts) });
      await assert.rejects(call(), (e) => {
        assert.ok(e instanceof ProviderError);
        assert.equal(e.code, 'AI_INVALID_RESPONSE');
        carriesNoThought(e, 'through the fake');
        noKey(e);
        return true;
      });
    }
  });
});

test('G13 · through the draft service: a thinking answer gives the same draft; schema-invalid output after a thought is refused; no thought in drafts, errors or logs', async () => {
  const fake = createFakeGemini();
  const url = await fake.listen();
  const s = serviceWith(createGeminiProvider({ apiKey: KEY, model: 'gm', timeoutMs: 2000, maxOutputTokens: 600, fetchImpl: forwardingFetch(url, geminiGenerateUrl('gm')) }));
  const thinking = (output) => candidateWith([{ text: THOUGHT, thought: true, thoughtSignature: SIGNATURE }, { text: JSON.stringify(output), thoughtSignature: SIGNATURE }]);
  const comparable = (d) => ({ status: d.status, draft: d.draft, issues: d.issues, provenance: d.provenance, versions: d.versions });
  try {
    fake.plan({ output: answer });
    const plain = await s.draft('Bread 9 EUR');
    fake.plan({ output: answer, candidates: thinking(answer), usage: thinkingUsage });
    const withThought = await s.draft('Bread 9 EUR');
    assert.equal(withThought.status, 'ready');
    assert.equal(withThought.draft.amount_cents, 900);
    assert.deepEqual(comparable(withThought), comparable(plain));
    carriesNoThought(JSON.stringify(withThought), 'draft');

    const refused = (what) => (e) => {
      assert.equal(e.status, 502, what);
      assert.equal(e.code, 'AI_INVALID_RESPONSE', what);
      carriesNoThought(e, what);
      return true;
    };
    fake.plan({ output: answer, candidates: thinking({ ...answer, extra: 'x' }) });
    await assert.rejects(s.draft('Bread 9 EUR'), refused('schema-invalid output after a thought'));
    fake.plan({ output: answer, candidates: thinking({ ...answer, amount_text: '18', currency_text: 'EUR', note_text: null }) });
    await assert.rejects(s.draft('Lunch 180 EUR'), refused('a span that is not a whole token after a thought'));
    fake.plan({ output: answer, candidates: candidateWith([{ text: THOUGHT, thought: true }]) });
    await assert.rejects(s.draft('Bread 9 EUR'), refused('a thought only'));

    carriesNoThought(JSON.stringify(s.logs), 'service log');
  } finally {
    s.close();
    await fake.close();
  }
});

'use strict';

// Gemini generateContent adapter — FOR SYNTHETIC EVALUATION ONLY (D-040, D-044).
//
// Gemini Free may use submitted content to improve Google products, so real
// financial descriptions must never reach it. The application never loads this
// file: src/ai/provider.js refuses WALLET_AI_PROVIDER=gemini before any
// adapter exists. Only qa/ai/evaluate.js --live constructs it, for the
// synthetic corpus, and only after its own switches and allowance.
//
// Contract with the rest of Wallet: the same ProviderError codes, the same
// 64 KiB streaming cap, no retries (one attempt is at most one request), and a
// result of { kind: 'output', output, usage } that service.js validates with
// the unchanged contract.js and normalize.js.
//
// API choice (S31, D-044, wording corrected in S32). Until S31 this adapter used
// the Interactions API (POST /v1beta/interactions), an official, supported
// Gemini API that lists gemini-2.5-flash-lite. Both real pilot requests on
// 2026-09-17 went there and failed (the second with HTTP 404); the exact cause is
// not proven, and nothing shows the model or the key to be defective. The adapter
// now uses generateContent, which is equally official and supported, by
// deliberate choice: the evaluator sends one stateless request and wants one
// JSON answer, and the read-only model list (npm run eval:ai:models) reports
// generateContent support per model, so the check before a request and the
// request itself concern the same method. Checked against the official
// models.generateContent reference on 2026-09-17, read-only:
//
//   POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
//   header x-goog-api-key
//   body { systemInstruction: { parts: [{ text }] },
//          contents: [{ role: "user", parts: [{ text }] }],
//          generationConfig: { responseMimeType: "application/json",
//                              responseJsonSchema, maxOutputTokens },
//          store: false }
//   response { candidates: [{ content: { parts: [{ text, thought?, thoughtSignature? }],
//              role }, finishReason }], promptFeedback: { blockReason },
//              usageMetadata: { promptTokenCount, candidatesTokenCount,
//              thoughtsTokenCount, totalTokenCount } }
//
// totalTokenCount is documented as prompt + thoughts + candidates, so output
// tokens are total − prompt (thought tokens are billed output); this also covers
// a zero candidatesTokenCount, which proto3 JSON omits. No request on this route
// has been sent yet.

const { MAX_RESPONSE_BYTES, ProviderError, readCapped } = require('./transport');

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// A model id is a single URL path segment: lowercase letters, digits, dots and
// hyphens, starting with a letter or digit. A leading "models/" is accepted.
const MODEL_ID = /^[a-z0-9][a-z0-9.-]{0,99}$/;

/** "gemini-2.5-flash-lite" from "gemini-2.5-flash-lite" or "models/gemini-2.5-flash-lite"; null if not a safe id. */
function normalizeGeminiModel(raw) {
  if (typeof raw !== 'string') return null;
  let id = raw.trim();
  if (id.startsWith('models/')) id = id.slice('models/'.length);
  return MODEL_ID.test(id) ? id : null;
}

function geminiGenerateUrl(model) {
  const id = normalizeGeminiModel(model);
  if (!id) throw new Error('Gemini model id must be a single path segment such as gemini-2.5-flash-lite');
  return `${GEMINI_API_BASE}/models/${id}:generateContent`;
}

// The Part fields Wallet accepts (official Part reference, 2026-09-17): the
// `text` data field and the two thought markers. The API defines more —
// other data fields (`inlineData`, `functionCall`, `fileData`,
// `executableCode`, …) and technical fields such as `partMetadata`,
// `mediaResolution` and `mediaProcessing`. Refusing everything outside this set
// is this project's strict policy, not a restriction of the API: an evaluator
// row is only ever one JSON answer, so an unexpected field stops the row
// instead of being ignored.
const PART_FIELDS = new Set(['text', 'thought', 'thoughtSignature']);

function readUsage(u) {
  if (!u || typeof u !== 'object' || !Number.isInteger(u.promptTokenCount) || !Number.isInteger(u.totalTokenCount)) return null;
  if (u.totalTokenCount < u.promptTokenCount) return null;
  const usage = { input_tokens: u.promptTokenCount, output_tokens: u.totalTokenCount - u.promptTokenCount };
  if (Number.isInteger(u.thoughtsTokenCount)) usage.reasoning_tokens = u.thoughtsTokenCount;
  return usage;
}

/** Raw REST parsing of a GenerateContentResponse. Returns { kind: 'output', output, usage }. */
function parseGenerateContent(bodyText) {
  let json;
  try {
    json = JSON.parse(bodyText);
  } catch {
    throw new ProviderError('AI_INVALID_RESPONSE', 'response body is not JSON');
  }
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new ProviderError('AI_INVALID_RESPONSE', 'response body is not an object');
  }

  // Read first, as in the OpenAI adapter (L7): an unusable answer can still be billed.
  const usage = readUsage(json.usageMetadata);
  const invalid = (detail) => Object.assign(new ProviderError('AI_INVALID_RESPONSE', detail), { usage });

  if (json.promptFeedback && typeof json.promptFeedback === 'object' && json.promptFeedback.blockReason) {
    throw invalid('prompt blocked');
  }
  if (!Array.isArray(json.candidates) || json.candidates.length !== 1) throw invalid('expected exactly one candidate');
  const candidate = json.candidates[0];
  if (!candidate || typeof candidate !== 'object') throw invalid('expected exactly one candidate');

  // Fail closed: only a natural stop is a finished answer.
  if (candidate.finishReason !== 'STOP') {
    const reason = typeof candidate.finishReason === 'string' ? candidate.finishReason.replace(/[^A-Z_]/g, '').slice(0, 40) || 'unknown' : 'missing';
    throw invalid(`finish reason ${reason}`);
  }
  const parts = candidate.content && candidate.content.parts;
  if (!Array.isArray(parts)) throw invalid('no content parts');

  // Thinking (S32, closes R-G1). A part may be thought (`thought: true`) or carry
  // only an opaque `thoughtSignature`; such parts are skipped. The whole response
  // body is of course parsed as JSON to get here — what does not happen is that a
  // thought's text is ever extracted from it: it is not returned, not logged and
  // not stored anywhere. Every other part must be the one final answer: `text` and
  // nothing else but an optional signature. A function call, media, code or any
  // other field is refused, never skipped.
  let answer = null;
  let answerIndex = -1;
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (!part || typeof part !== 'object' || Array.isArray(part)) throw invalid('unexpected part');
    if (Object.keys(part).some((k) => !PART_FIELDS.has(k))) throw invalid('unexpected part');
    if ('thought' in part && typeof part.thought !== 'boolean') throw invalid('unexpected part');
    if ('thoughtSignature' in part && typeof part.thoughtSignature !== 'string') throw invalid('unexpected part');
    if ('text' in part && typeof part.text !== 'string') throw invalid('unexpected part');
    if (part.thought === true) continue;
    if (!('text' in part)) {
      if ('thoughtSignature' in part) continue;
      throw invalid('unexpected part');
    }
    if (answer !== null) throw invalid('more than one final text part');
    answer = part.text;
    answerIndex = i;
  }
  if (answer === null) throw invalid('no final text part');
  if (answerIndex !== parts.length - 1) throw invalid('final text part is not last');

  let output;
  try {
    output = JSON.parse(answer);
  } catch {
    throw invalid('output text is not JSON');
  }
  return { kind: 'output', output, usage };
}

/**
 * @param {object} options
 * @param {string} options.apiKey
 * @param {string} options.model
 * @param {number} options.timeoutMs
 * @param {number} options.maxOutputTokens
 * @param {typeof fetch} [options.fetchImpl]  injected by tests only
 */
function createGeminiProvider({ apiKey, model, timeoutMs, maxOutputTokens, fetchImpl = globalThis.fetch }) {
  if (!apiKey) throw new Error('createGeminiProvider needs a key');
  const url = geminiGenerateUrl(model);

  async function extract({ instructions, userJson, schema, signal }) {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onCallerAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener('abort', onCallerAbort, { once: true });
    }

    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: instructions }] },
      // The description travels as a JSON document, separate from instructions.
      contents: [{ role: 'user', parts: [{ text: userJson }] }],
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema, maxOutputTokens },
      // Documented per-request logging switch. Free Tier data use for product
      // improvement is a separate matter this flag does not change.
      store: false,
    });

    try {
      let response;
      try {
        response = await fetchImpl(url, {
          method: 'POST',
          // The key goes in a header, never in the URL, so it cannot end up in
          // an access log or an error that quotes the URL.
          headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
          body,
          // A redirect could forward the key header somewhere else.
          redirect: 'manual',
          signal: controller.signal,
        });
      } catch {
        if (timedOut) throw new ProviderError('AI_TIMEOUT', 'deadline exceeded before a response');
        throw new ProviderError('AI_PROVIDER_FAILED', controller.signal.aborted ? 'request cancelled' : 'network failure');
      }

      // Non-2xx: the body is cancelled unread, and only the numeric status is
      // kept (D-042) — the body and headers may quote the request or the key.
      const httpStatus = response.status;
      if (response.type === 'opaqueredirect' || (httpStatus >= 300 && httpStatus < 400)) {
        await response.body?.cancel().catch(() => {});
        throw new ProviderError('AI_PROVIDER_FAILED', 'redirect refused', { httpStatus });
      }
      if (httpStatus === 429 || httpStatus === 503) {
        await response.body?.cancel().catch(() => {});
        throw new ProviderError('AI_PROVIDER_BUSY', `upstream ${httpStatus}`, { httpStatus });
      }
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        throw new ProviderError('AI_PROVIDER_FAILED', `upstream ${httpStatus}`, { httpStatus });
      }

      let text;
      try {
        text = await readCapped(response, MAX_RESPONSE_BYTES);
      } catch (err) {
        if (err instanceof ProviderError) throw err;
        if (timedOut) throw new ProviderError('AI_TIMEOUT', 'deadline exceeded while reading');
        throw new ProviderError('AI_PROVIDER_FAILED', 'body read failed');
      }
      return parseGenerateContent(text);
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onCallerAbort);
    }
  }

  return { name: 'Gemini', mode: 'live', model, extract };
}

module.exports = { GEMINI_API_BASE, geminiGenerateUrl, normalizeGeminiModel, createGeminiProvider, parseGenerateContent };

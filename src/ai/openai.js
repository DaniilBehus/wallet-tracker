'use strict';

// The application's only live provider: OpenAI Responses API over native
// fetch (spec/ai-expense-entry.md §3, §7; D-034, D-040). The Gemini adapter in
// gemini.js exists for synthetic evaluation only and is never used by the app.
//
// Everything a live call can do wrong is decided here and reduced to a small
// set of safe codes. No upstream body, header or key ever leaves this file in
// an error. There is no retry: one attempt is at most one HTTP request.
//
// Request format checked against the official Structured Outputs guide on
// 2026-09-14: `text.format` = { type: 'json_schema', name, strict: true,
// schema }; refusals arrive as a content block of type `refusal`; truncation
// as `status: 'incomplete'`. Compatibility with a real account is NOT verified
// in S23 — no key was configured (LIVE NOT RUN).

// The error type and the byte cap moved to transport.js unchanged (D-040) so
// the Gemini adapter uses the very same ones; they are re-exported here.
const { MAX_RESPONSE_BYTES, ProviderError, readCapped } = require('./transport');

const API_URL = 'https://api.openai.com/v1/responses';

/** Token counts the provider reported, or null. Counts only; nothing else is kept. */
function readUsage(u) {
  if (!u || !Number.isInteger(u.input_tokens) || !Number.isInteger(u.output_tokens)) return null;
  const usage = { input_tokens: u.input_tokens, output_tokens: u.output_tokens };
  const reasoning = u.output_tokens_details && u.output_tokens_details.reasoning_tokens;
  if (Number.isInteger(reasoning)) usage.reasoning_tokens = reasoning;
  return usage;
}

/** Raw REST parsing. Returns { kind: 'output', output } or { kind: 'refusal' }. */
function parseResponseBody(bodyText) {
  let json;
  try {
    json = JSON.parse(bodyText);
  } catch {
    throw new ProviderError('AI_INVALID_RESPONSE', 'response body is not JSON');
  }
  if (!json || typeof json !== 'object') {
    throw new ProviderError('AI_INVALID_RESPONSE', 'response body is not an object');
  }

  // Read first: a response that is billed but unusable still has a cost, and
  // "unknown usage" must mean the provider did not say, not that we threw it
  // away (L7). Reasoning models count reasoning tokens in max_output_tokens and
  // can end incomplete before any visible output.
  const usage = readUsage(json.usage);
  const invalid = (detail) => Object.assign(new ProviderError('AI_INVALID_RESPONSE', detail), { usage });

  if (json.status === 'incomplete') {
    const reason = json.incomplete_details && typeof json.incomplete_details.reason === 'string'
      ? json.incomplete_details.reason.replace(/[^a-z_]/gi, '').slice(0, 40)
      : 'unknown';
    throw invalid(`response is incomplete: ${reason}`);
  }
  if (json.status !== 'completed') throw invalid('response is not completed');
  if (!Array.isArray(json.output)) throw invalid('response has no output array');

  const messages = json.output.filter((item) => item && item.type === 'message');
  const others = json.output.filter((item) => !item || (item.type !== 'message' && item.type !== 'reasoning'));
  if (others.length > 0) throw invalid('unexpected output item type');
  if (messages.length !== 1) throw invalid('expected exactly one message');

  const content = messages[0].content;
  if (!Array.isArray(content) || content.length !== 1) throw invalid('expected exactly one content block');
  const block = content[0];

  if (block && block.type === 'refusal') return { kind: 'refusal', usage };
  if (!block || block.type !== 'output_text' || typeof block.text !== 'string') {
    throw invalid('unexpected content block');
  }
  let output;
  try {
    output = JSON.parse(block.text);
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
function createOpenAIProvider({ apiKey, model, timeoutMs, maxOutputTokens, fetchImpl = globalThis.fetch }) {
  if (!apiKey || !model) throw new Error('createOpenAIProvider needs a key and a model');

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
      model,
      instructions,
      input: [{ role: 'user', content: [{ type: 'input_text', text: userJson }] }],
      text: { format: { type: 'json_schema', name: 'wallet_expense_draft', strict: true, schema } },
      store: false,
      max_output_tokens: maxOutputTokens,
    });

    try {
      let response;
      try {
        response = await fetchImpl(API_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body,
          // A redirect could forward the Authorization header somewhere else.
          redirect: 'manual',
          signal: controller.signal,
        });
      } catch (err) {
        if (timedOut) throw new ProviderError('AI_TIMEOUT', 'deadline exceeded before a response');
        throw new ProviderError('AI_PROVIDER_FAILED', controller.signal.aborted ? 'request cancelled' : 'network failure');
      }

      if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
        await response.body?.cancel().catch(() => {});
        throw new ProviderError('AI_PROVIDER_FAILED', 'redirect refused');
      }
      if (response.status === 429 || response.status === 503) {
        await response.body?.cancel().catch(() => {});
        throw new ProviderError('AI_PROVIDER_BUSY', `upstream ${response.status}`);
      }
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        throw new ProviderError('AI_PROVIDER_FAILED', `upstream ${response.status}`);
      }

      let text;
      try {
        text = await readCapped(response, MAX_RESPONSE_BYTES);
      } catch (err) {
        if (err instanceof ProviderError) throw err;
        if (timedOut) throw new ProviderError('AI_TIMEOUT', 'deadline exceeded while reading');
        throw new ProviderError('AI_PROVIDER_FAILED', 'body read failed');
      }
      return parseResponseBody(text);
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onCallerAbort);
    }
  }

  return { name: 'OpenAI', mode: 'live', model, extract };
}

module.exports = {
  API_URL,
  MAX_RESPONSE_BYTES,
  ProviderError,
  createOpenAIProvider,
  parseResponseBody,
};

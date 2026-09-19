'use strict';

/*
 * Read-only Gemini model-list diagnostic (S31, D-044): `npm run eval:ai:models`.
 *
 * It answers one question after a failed live pilot: is the configured model
 * available to this key at all? It only ever sends
 *
 *   GET https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000
 *
 * (plus pageToken for further pages, at most 5 requests) with the key in the
 * x-goog-api-key header — the documented models.list method (read 2026-09-17).
 * It prints each Gemini model's name and whether it supports generateContent,
 * and a verdict for WALLET_AI_GEMINI_MODEL. It never generates anything, never
 * prints or stores the key, keeps only the numeric status of a non-2xx answer
 * (never its body or headers), opens no database and writes no file. It never
 * selects a model or edits configuration; candidates are for the operator.
 *
 * Exit codes: 0 available, 3 not run (missing configuration), 4 configured model
 * not listed, 5 listed without generateContent, 6 list failed, 2 refused or
 * unexpected error.
 */

const { isGuardActive } = require('./support/network-guard-state');

const GEMINI_MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const PAGE_SIZE = 1000;
const MAX_REQUESTS = 5;
const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 15000;

class ModelListError extends Error {
  /** @param {'HTTP_STATUS'|'NO_HTTP_ANSWER'|'INVALID_RESPONSE'} kind */
  constructor(kind, httpStatus) {
    const text = {
      HTTP_STATUS: `model list request failed: HTTP ${httpStatus}`,
      NO_HTTP_ANSWER: 'model list request got no HTTP answer',
      INVALID_RESPONSE: 'model list response could not be used',
    }[kind];
    super(text);
    this.name = 'ModelListError';
    this.kind = kind;
    if (kind === 'HTTP_STATUS') this.httpStatus = httpStatus;
  }
}

const invalid = () => new ModelListError('INVALID_RESPONSE');

async function readCappedText(response, maxBytes) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw invalid();
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function pageUrl(pageToken) {
  const url = new URL(GEMINI_MODELS_URL);
  url.searchParams.set('pageSize', String(PAGE_SIZE));
  if (pageToken) url.searchParams.set('pageToken', pageToken);
  return url.toString();
}

/**
 * Raw `models[]` entries to [{ id, generateContent }] for Gemini models only.
 * Anything not in the documented shape makes the whole list unusable.
 */
function summarizeModels(raw) {
  if (!Array.isArray(raw)) throw invalid();
  return raw.map((m) => {
    if (!m || typeof m !== 'object' || typeof m.name !== 'string' || !m.name.startsWith('models/')) throw invalid();
    const methods = m.supportedGenerationMethods === undefined ? [] : m.supportedGenerationMethods;
    if (!Array.isArray(methods) || methods.some((x) => typeof x !== 'string')) throw invalid();
    return { id: m.name.slice('models/'.length), generateContent: methods.includes('generateContent') };
  }).filter((m) => m.id.startsWith('gemini'));
}

/**
 * @returns {Promise<{models: {id: string, generateContent: boolean}[], requests: number, httpStatus: number}>}
 * @throws {ModelListError}
 */
async function listGeminiModels({ apiKey, fetchImpl = globalThis.fetch, timeoutMs = TIMEOUT_MS }) {
  if (!apiKey) throw new Error('listGeminiModels needs a key');
  const models = [];
  let pageToken = null;
  let requests = 0;
  let httpStatus = null;
  do {
    if (requests >= MAX_REQUESTS) throw invalid();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      requests += 1;
      let response;
      try {
        response = await fetchImpl(pageUrl(pageToken), {
          method: 'GET',
          // The key goes in a header, never in the URL.
          headers: { 'x-goog-api-key': apiKey },
          redirect: 'manual',
          signal: controller.signal,
        });
      } catch {
        throw new ModelListError('NO_HTTP_ANSWER');
      }
      if (!response.ok) {
        // Non-2xx, redirects included: the body is cancelled unread.
        await response.body?.cancel().catch(() => {});
        const status = response.status;
        if (Number.isInteger(status) && status >= 100 && status <= 599) throw new ModelListError('HTTP_STATUS', status);
        throw new ModelListError('NO_HTTP_ANSWER');
      }
      httpStatus = response.status;
      let text;
      try {
        text = await readCappedText(response, MAX_PAGE_BYTES);
      } catch {
        throw invalid();
      }
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw invalid();
      }
      if (!json || typeof json !== 'object' || Array.isArray(json)) throw invalid();
      models.push(...summarizeModels(json.models === undefined ? [] : json.models));
      if (json.nextPageToken !== undefined && typeof json.nextPageToken !== 'string') throw invalid();
      pageToken = json.nextPageToken || null;
    } finally {
      clearTimeout(timer);
    }
  } while (pageToken);
  return { models, requests, httpStatus };
}

const normalizeModelId = (raw) => {
  const id = String(raw || '').trim();
  return id.startsWith('models/') ? id.slice('models/'.length) : id;
};

/** Exact match only: no prefix, alias or fuzzy matching. */
function diagnose({ models, configuredModel }) {
  const configured = normalizeModelId(configuredModel);
  const found = models.find((m) => m.id === configured);
  if (!found) return { verdict: 'UNAVAILABLE', configured, message: `configured model is unavailable for this key: ${configured}` };
  if (!found.generateContent) {
    return { verdict: 'UNSUPPORTED_METHOD', configured, message: `configured model is available for this key but does not support generateContent: ${configured}` };
  }
  return { verdict: 'AVAILABLE', configured, message: `configured model is available for this key and supports generateContent: ${configured}` };
}

// A stable, versioned Flash or Flash-Lite text model: no preview, experimental,
// TTS, image, live, embedding or -latest alias.
const STABLE_FLASH = /^gemini-(\d+(?:\.\d+)?)-flash(-lite)?(?:-\d{3})?$/;

/** Candidates for the operator, newest version first, Flash-Lite before Flash. Never selected here. */
function flashCandidates(models) {
  return models
    .filter((m) => m.generateContent && STABLE_FLASH.test(m.id))
    .map((m) => {
      const [, version, lite] = m.id.match(STABLE_FLASH);
      return { id: m.id, version: Number(version), lite: Boolean(lite) };
    })
    .sort((a, b) => b.version - a.version || Number(b.lite) - Number(a.lite) || a.id.localeCompare(b.id))
    .map((c) => c.id);
}

/** Test seam: forwards only the models URL (path and query) to a loopback fake. */
function loopbackModelsFetch(base) {
  return (url, init) => {
    const u = new URL(url);
    if (`${u.origin}${u.pathname}` !== GEMINI_MODELS_URL) {
      return Promise.reject(new Error('model list diagnostic requested an unexpected URL'));
    }
    return fetch(`${base}${u.pathname}${u.search}`, init);
  };
}

/** The same rule as the evaluator's seam (D-041): process-local guard proof and a strict loopback URL. */
function fetchFor(env) {
  const fakeUrl = env.WALLET_AI_EVAL_TEST_FAKE_URL;
  if (fakeUrl === undefined || fakeUrl === '') return globalThis.fetch;
  if (!isGuardActive()) {
    throw new Error('test seam refused: the network guard is not active in this process; WALLET_AI_EVAL_TEST_FAKE_URL needs qa/ai/support/no-network.js preloaded');
  }
  return loopbackModelsFetch(require('./evaluate').loopbackFakeBase(fakeUrl));
}

async function main(env = process.env, out = (line) => console.log(line)) {
  const fetchImpl = fetchFor(env);
  out('Gemini model list — read-only diagnostic: no generation request, the key is never printed or stored, nothing is written');
  out(`endpoint: GET ${GEMINI_MODELS_URL}`);
  const missing = [];
  if (!env.GEMINI_API_KEY) missing.push('GEMINI_API_KEY');
  if (!normalizeModelId(env.WALLET_AI_GEMINI_MODEL)) missing.push('WALLET_AI_GEMINI_MODEL');
  if (missing.length > 0) {
    out(`NOT RUN: missing ${missing.join(', ')}`);
    return 3;
  }
  const configured = normalizeModelId(env.WALLET_AI_GEMINI_MODEL);
  out(`configured model: ${configured}`);

  let listed;
  try {
    listed = await listGeminiModels({ apiKey: env.GEMINI_API_KEY, fetchImpl });
  } catch (err) {
    if (!(err instanceof ModelListError)) throw err;
    out(`HTTP status: ${err.kind === 'HTTP_STATUS' ? err.httpStatus : 'none'}`);
    out(`RESULT: LIST_FAILED — ${err.message}`);
    return 6;
  }
  out(`HTTP status: ${listed.httpStatus} (${listed.requests} request${listed.requests === 1 ? '' : 's'})`);
  out(`Gemini models available to this key (${listed.models.length}):`);
  for (const m of listed.models) out(`  ${m.id} · generateContent: ${m.generateContent ? 'yes' : 'no'}`);
  const d = diagnose({ models: listed.models, configuredModel: configured });
  if (d.verdict !== 'AVAILABLE') {
    const candidates = flashCandidates(listed.models);
    out(`non-preview Flash/Flash-Lite models supporting generateContent (not selected; the operator decides): ${candidates.length > 0 ? candidates.join(', ') : 'none'}`);
  }
  out(`RESULT: ${d.verdict} — ${d.message}`);
  return { AVAILABLE: 0, UNAVAILABLE: 4, UNSUPPORTED_METHOD: 5 }[d.verdict];
}

if (require.main === module) {
  main().then((code) => { process.exitCode = code; }).catch((err) => {
    const message = err && typeof err.message === 'string' && err.message.startsWith('test seam refused') ? err.message : 'unexpected failure (details are not printed, so that no key or response text can leak)';
    console.error(`gemini-models error: ${message}`);
    process.exitCode = 2;
  });
}

module.exports = { GEMINI_MODELS_URL, ModelListError, listGeminiModels, summarizeModels, diagnose, flashCandidates, loopbackModelsFetch, main };

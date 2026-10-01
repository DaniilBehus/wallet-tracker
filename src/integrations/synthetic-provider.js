'use strict';

// Offline demonstrator only: no route accepts a provider URL or real credential.
const { isValidDate } = require('../dates');
// Mirror the preview contract without importing validate.js, which opens SQLite.
const MAX_AMOUNT_CENTS = 100000000;
const SOURCE = 'synthetic-demo-v1';
const DEMO_AUTH = 'synthetic-test-only';

class SyntheticProviderError extends Error {
  constructor(code, message) { super(message); this.name = 'SyntheticProviderError'; this.code = code; }
}
const fail = (code, message) => { throw new SyntheticProviderError(code, message); };
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v, required, optional = []) => object(v) &&
  required.every(k => Object.hasOwn(v, k)) &&
  Object.keys(v).every(k => required.includes(k) || optional.includes(k));

function target(baseUrl) {
  let url;
  try { url = new URL(baseUrl); } catch { fail('INVALID_TARGET', 'Synthetic provider target is not allowed'); }
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    fail('INVALID_TARGET', 'Synthetic provider target is not allowed');
  }
  return new URL('/records', url);
}

function validate(payload) {
  if (!exact(payload, ['records']) || !Array.isArray(payload.records) ||
      payload.records.length < 1 || payload.records.length > 10) {
    fail('INVALID_RESPONSE', 'Synthetic provider returned invalid records');
  }
  const ids = new Set();
  const records = payload.records.map(r => {
    if (!exact(r, ['external_id', 'amount_cents', 'spent_on', 'category_name'], ['note']) ||
        typeof r.external_id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(r.external_id) ||
        ids.has(r.external_id) || typeof r.amount_cents !== 'number' ||
        !Number.isInteger(r.amount_cents) || r.amount_cents < 1 ||
        r.amount_cents > MAX_AMOUNT_CENTS || !isValidDate(r.spent_on) ||
        typeof r.category_name !== 'string' || !r.category_name.trim() ||
        r.category_name.length > 60 ||
        (r.note !== undefined && r.note !== null &&
          (typeof r.note !== 'string' || r.note.length > 160))) {
      fail('INVALID_RESPONSE', 'Synthetic provider returned invalid records');
    }
    ids.add(r.external_id);
    return { external_id: r.external_id, amount_cents: r.amount_cents,
      spent_on: r.spent_on, category_name: r.category_name,
      ...(Object.hasOwn(r, 'note') ? { note: r.note } : {}) };
  });
  return { source: SOURCE, records };
}

async function fetchSyntheticBatch({ providerBaseUrl, timeoutMs = 1000,
  maxResponseBytes = 16384 } = {}) {
  const url = target(providerBaseUrl);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000 ||
      !Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 1 || maxResponseBytes > 65536) {
    fail('INVALID_OPTIONS', 'Synthetic provider limits are invalid');
  }
  try {
    const response = await fetch(url, { redirect: 'manual',
      headers: { accept: 'application/json', authorization: `Bearer ${DEMO_AUTH}` },
      signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) {
      fail(response.status === 401 || response.status === 403 ? 'UPSTREAM_DENIED' : 'UPSTREAM_STATUS',
        'Synthetic provider request failed');
    }
    if (!response.body) fail('INVALID_RESPONSE', 'Synthetic provider returned invalid records');
    const reader = response.body.getReader();
    const chunks = [];
    let bytes = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > maxResponseBytes) fail('RESPONSE_TOO_LARGE', 'Synthetic provider response is too large');
        chunks.push(Buffer.from(value));
      }
    } finally {
      if (bytes > maxResponseBytes) await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    let payload;
    try { payload = JSON.parse(Buffer.concat(chunks, bytes).toString('utf8')); }
    catch { fail('INVALID_RESPONSE', 'Synthetic provider returned invalid records'); }
    return validate(payload);
  } catch (error) {
    if (error instanceof SyntheticProviderError) throw error;
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      fail('UPSTREAM_TIMEOUT', 'Synthetic provider timed out');
    }
    fail('UPSTREAM_UNAVAILABLE', 'Synthetic provider is unavailable');
  }
}

module.exports = { fetchSyntheticBatch, SyntheticProviderError };

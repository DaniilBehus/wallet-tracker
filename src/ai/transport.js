'use strict';

// What every provider adapter shares (D-040): the safe error type and the
// streaming byte cap. Each adapter owns its own endpoint, request body and
// response parsing; none of them may add a code outside ProviderError's four,
// and none may put an upstream body, header or key into an error.

const MAX_RESPONSE_BYTES = 64 * 1024;

class ProviderError extends Error {
  /**
   * @param {'AI_TIMEOUT'|'AI_PROVIDER_BUSY'|'AI_PROVIDER_FAILED'|'AI_INVALID_RESPONSE'} code
   * @param {string} [detail]
   * @param {{httpStatus?: number}} [options]
   */
  constructor(code, detail, { httpStatus } = {}) {
    super(detail || code);
    this.name = 'ProviderError';
    this.code = code;
    // A short internal reason for tests and logs; never an upstream body.
    this.detail = detail || code;
    // D-042: the numeric status of a non-2xx answer, and nothing else from it.
    // For the evaluator's report only; service.js maps this error to a generic
    // ApiError and does not pass it on.
    if (Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599) this.httpStatus = httpStatus;
  }
}

async function readCapped(response, maxBytes = MAX_RESPONSE_BYTES) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    // Counted while streaming: Content-Length can be missing or wrong.
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new ProviderError('AI_INVALID_RESPONSE', 'response body exceeded the byte cap');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString('utf8');
}

module.exports = { MAX_RESPONSE_BYTES, ProviderError, readCapped };

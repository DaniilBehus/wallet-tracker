'use strict';

// Shapes at the two trust boundaries of the AI draft feature
// (spec/ai-expense-entry.md §4.2 and §5):
//
//   client -> server   the parse request, validated before any work happens;
//   provider -> server the model's answer, validated before it is believed.
//
// Both are exact-key contracts. An extra key is refused rather than ignored,
// for the same reason D-029 refuses unknown PATCH fields: a silently dropped
// field produces a client and a server that are each right and data that is
// wrong.

// errors.js, not validate.js: this module must stay importable without a
// database (see src/errors.js).
const { ApiError } = require('../errors');
const { isValidDate } = require('../dates');

const badRequest = (message) => new ApiError(400, 'VALIDATION_FAILED', message);
const { nfc, codePointLength } = require('./normalize');

const SCHEMA_VERSION = '1';
const MAX_INPUT_CODE_POINTS = 500;
const MAX_BODY_BYTES = 8 * 1024;
const LOCALES = ['en', 'uk', 'sk', 'auto'];
const REQUEST_KEYS = ['text', 'reference_date', 'locale', 'consent_to_external_processing'];

const INTENTS = ['expense', 'multiple_expenses', 'non_expense', 'unclear'];
const LANGUAGES = ['en', 'uk', 'sk', 'other', 'mixed', 'unknown'];
const OUTPUT_LIMITS = {
  amount_text: 40,
  currency_text: 24,
  date_text: 60,
  category_ref: 8,
  note_text: 200,
};
const OUTPUT_KEYS = ['intent', 'language', ...Object.keys(OUTPUT_LIMITS)];

/** The strict JSON schema sent to the provider (Structured Outputs). */
const PROVIDER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: OUTPUT_KEYS,
  properties: {
    intent: { type: 'string', enum: INTENTS },
    language: { type: 'string', enum: LANGUAGES },
    amount_text: { type: ['string', 'null'] },
    currency_text: { type: ['string', 'null'] },
    date_text: { type: ['string', 'null'] },
    category_ref: { type: ['string', 'null'] },
    note_text: { type: ['string', 'null'] },
  },
};

// ---------------------------------------------------------------- request

/**
 * @returns {{text, referenceDate, locale, consent}}
 * @throws ApiError 400 VALIDATION_FAILED
 */
function validateDraftRequest(body, rawBytes) {
  if (typeof rawBytes === 'number' && rawBytes > MAX_BODY_BYTES) {
    throw badRequest(`the request body must not exceed ${MAX_BODY_BYTES} bytes`);
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('the request body must be a JSON object');
  }

  const unknown = Object.keys(body).filter((k) => !REQUEST_KEYS.includes(k));
  if (unknown.length > 0) {
    throw badRequest(`unknown field${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ')}`);
  }

  if (typeof body.text !== 'string') throw badRequest('text must be a string');
  const text = nfc(body.text);
  if (text.trim() === '') throw badRequest('text must not be empty');
  if (codePointLength(text) > MAX_INPUT_CODE_POINTS) {
    throw badRequest(`text must be at most ${MAX_INPUT_CODE_POINTS} characters`);
  }

  if (typeof body.reference_date !== 'string' || !isValidDate(body.reference_date)) {
    throw badRequest('reference_date must be a date in YYYY-MM-DD form');
  }

  let locale = 'auto';
  if (body.locale !== undefined) {
    if (typeof body.locale !== 'string' || !LOCALES.includes(body.locale)) {
      throw badRequest(`locale must be one of ${LOCALES.join(', ')}`);
    }
    locale = body.locale;
  }

  let consent = false;
  if (body.consent_to_external_processing !== undefined) {
    if (typeof body.consent_to_external_processing !== 'boolean') {
      throw badRequest('consent_to_external_processing must be a boolean');
    }
    consent = body.consent_to_external_processing;
  }

  return { text, referenceDate: body.reference_date, locale, consent };
}

// --------------------------------------------------------------- provider

class InvalidProviderOutput extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'InvalidProviderOutput';
  }
}

/**
 * Exact shape check of the parsed provider object. Semantic checks (literal
 * spans, refs) happen in normalize.derive.
 */
function validateProviderOutput(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new InvalidProviderOutput('output is not an object');
  }
  const keys = Object.keys(value);
  const extra = keys.filter((k) => !OUTPUT_KEYS.includes(k));
  if (extra.length > 0) throw new InvalidProviderOutput(`unexpected keys: ${extra.length}`);
  const missing = OUTPUT_KEYS.filter((k) => !(k in value));
  if (missing.length > 0) throw new InvalidProviderOutput(`missing keys: ${missing.length}`);

  if (!INTENTS.includes(value.intent)) throw new InvalidProviderOutput('intent out of enum');
  if (!LANGUAGES.includes(value.language)) throw new InvalidProviderOutput('language out of enum');

  for (const [key, max] of Object.entries(OUTPUT_LIMITS)) {
    const v = value[key];
    if (v === null) continue;
    if (typeof v !== 'string') throw new InvalidProviderOutput(`${key} has the wrong type`);
    if (codePointLength(v) > max) throw new InvalidProviderOutput(`${key} is too long`);
  }
  if (value.category_ref !== null && !/^c\d{1,2}$/.test(value.category_ref)) {
    throw new InvalidProviderOutput('category_ref is not a ref');
  }
  return value;
}

/** The fixed 502 the route answers for any contract failure. */
const invalidResponse = () =>
  new ApiError(502, 'AI_INVALID_RESPONSE', 'The AI service returned an answer that could not be used');

module.exports = {
  SCHEMA_VERSION,
  MAX_INPUT_CODE_POINTS,
  MAX_BODY_BYTES,
  LOCALES,
  PROVIDER_SCHEMA,
  OUTPUT_KEYS,
  InvalidProviderOutput,
  validateDraftRequest,
  validateProviderOutput,
  invalidResponse,
};

'use strict';

// The error contract and the field validators live together, because they are
// two halves of one job: a validator's only possible outcome is a correctly
// shaped error. Not in the spec's §7 file list — a deliberate design decision (D-005).
//
// Every error response in this app has the same shape (spec §5):
//   { "error": { "code": "VALIDATION_FAILED", "message": "..." } }
// Nothing writes that body by hand. Handlers throw an ApiError and the single
// renderer in server.js turns it into a response — which is what keeps the
// contract consistent enough to be worth testing against.

const { db } = require('./db');
const { isValidDate, today, dayAfter } = require('./dates');

const MAX_AMOUNT_CENTS = 100000000; // 1 000 000 EUR, spec §4.3
const MAX_NAME_LENGTH = 60;

// Defined in errors.js so that pure modules can throw it without opening the
// database this file opens (S23). Re-exported below; nothing else changes.
const { ApiError } = require('./errors');

const badRequest = (message) => new ApiError(400, 'VALIDATION_FAILED', message);
const unauthorized = (message) => new ApiError(401, 'UNAUTHORIZED', message);
const forbidden = (message) => new ApiError(403, 'FORBIDDEN', message);
const notFound = (message) => new ApiError(404, 'NOT_FOUND', message);
const conflict = (message) => new ApiError(409, 'CONFLICT', message);

// --------------------------------------------------------------------- fields

function amountCents(value) {
  if (value === undefined || value === null) throw badRequest('amount_cents is required');
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw badRequest('amount_cents must be an integer number of cents');
  }
  if (value <= 0) throw badRequest('amount_cents must be a positive integer');
  if (value > MAX_AMOUNT_CENTS) {
    throw badRequest(`amount_cents must not exceed ${MAX_AMOUNT_CENTS}`);
  }
  return value;
}

/**
 * Monthly income (D-021). Unlike amount_cents this MAY be zero — zero is how
 * "not set yet" is expressed, and §3's CHECK allows it. Negative is refused:
 * the app models money going out, and a negative income has no meaning here.
 */
function incomeCents(value) {
  if (value === undefined || value === null) {
    throw badRequest('monthly_income_cents is required');
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw badRequest('monthly_income_cents must be an integer number of cents');
  }
  if (value < 0) throw badRequest('monthly_income_cents must not be negative');
  if (value > MAX_AMOUNT_CENTS) {
    throw badRequest(`monthly_income_cents must not exceed ${MAX_AMOUNT_CENTS}`);
  }
  return value;
}

/**
 * The monthly spending limit (qa/docs/analysis-monthly-limit.md).
 *
 * Three answers, not two: a number sets the limit, an explicit null clears it,
 * and an absent field leaves whatever is stored alone. That is why this returns
 * `undefined` for "absent" rather than treating it as zero — 0 is a real limit
 * meaning "nothing may be spent", and silently turning "no limit" into it would
 * be the app inventing a budget nobody set (assumption A3).
 */
function limitCents(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw badRequest('monthly_limit_cents must be an integer number of cents, or null');
  }
  if (value < 0) throw badRequest('monthly_limit_cents must not be negative');
  if (value > MAX_AMOUNT_CENTS) {
    throw badRequest(`monthly_limit_cents must not exceed ${MAX_AMOUNT_CENTS}`);
  }
  return value;
}

function name(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw badRequest('name is required');
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw badRequest(`name must be at most ${MAX_NAME_LENGTH} characters`);
  }
  return trimmed;
}

function dayOfMonth(value) {
  if (!Number.isInteger(value) || value < 1 || value > 31) {
    throw badRequest('day_of_month must be an integer between 1 and 31');
  }
  return value;
}

/**
 * A spending date. Undefined means today. At most one day in the future is
 * allowed, so that a phone whose clock is a few hours ahead of the server still
 * works (spec §4.3).
 */
function spentOn(value) {
  if (value === undefined || value === null) return today();
  if (!isValidDate(value)) throw badRequest('spent_on must be a date in YYYY-MM-DD form');
  if (value > dayAfter(today())) throw badRequest('spent_on must not be more than one day in the future');
  return value;
}

function startsOn(value) {
  if (!isValidDate(value)) throw badRequest('starts_on must be a date in YYYY-MM-DD form');
  return value;
}

/** Optional. Present means a loan of N instalments; absent means a subscription. */
function totalCount(value) {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || value <= 0) {
    throw badRequest('total_count must be a positive integer when present');
  }
  return value;
}

/**
 * The shape rules a PATCH body has to satisfy, before any field is looked at.
 * Returns the list of keys the caller should apply (D-029).
 *
 * Three refusals, in this order, because the order decides which message the
 * client gets when a body breaks more than one rule:
 *
 *   1. a server-owned field — the most specific complaint, and the one worth
 *      naming: a client sending `paid_count` believes it can set a counter.
 *      Ignoring it would leave that belief intact and the data unchanged, which
 *      is the worst of both.
 *   2. an unknown field — almost always a typo for a real one, and silently
 *      dropping it produces a bug where client and server are each correct and
 *      the stored row is wrong anyway.
 *   3. nothing at all — a request to change nothing is a client bug every time.
 *      200 would hide it.
 */
function patchFields(body, { allowed, serverOwned }) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('the request body must be a JSON object');
  }
  const keys = Object.keys(body);

  const owned = keys.filter((k) => serverOwned.includes(k));
  if (owned.length > 0) {
    throw badRequest(
      `${owned.join(', ')} ${owned.length === 1 ? 'is' : 'are'} set by the server and cannot be changed`
    );
  }

  const unknown = keys.filter((k) => !allowed.includes(k));
  if (unknown.length > 0) {
    throw badRequest(
      `unknown field${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ')}. ` +
      `Editable: ${allowed.join(', ')}`
    );
  }

  if (keys.length === 0) throw badRequest('at least one field must be given');
  return keys;
}

function positiveIntParam(raw, { fallback, max, field }) {
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw badRequest(`${field} must be a non-negative integer`);
  }
  if (max !== undefined && parsed > max) throw badRequest(`${field} must not exceed ${max}`);
  return parsed;
}

/** An id from a URL path or query string. */
function id(raw, field) {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) throw badRequest(`${field} must be a positive integer`);
  return parsed;
}

/**
 * A category id belonging to this user, or null when none was given.
 *
 * A category that exists but belongs to somebody else returns 404, not 403
 * (spec §4.3). 403 would confirm that the row exists, which leaks the existence
 * of another user's data to anyone willing to enumerate ids.
 */
function ownedCategoryId(raw, userId) {
  if (raw === undefined || raw === null || raw === '') return null;
  const categoryId = id(raw, 'category_id');
  const row = db
    .prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?')
    .get(categoryId, userId);
  if (!row) throw notFound(`No category with id ${categoryId}`);
  return categoryId;
}

module.exports = {
  ApiError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  amountCents,
  incomeCents,
  limitCents,
  name,
  dayOfMonth,
  spentOn,
  startsOn,
  totalCount,
  patchFields,
  positiveIntParam,
  id,
  ownedCategoryId,
  MAX_AMOUNT_CENTS,
  MAX_NAME_LENGTH,
};

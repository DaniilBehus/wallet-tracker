'use strict';

const { isValidDate } = require('./dates');
const { ApiError } = require('./errors');

const MAX_CURSOR_LENGTH = 512;
const KEYS = ['v', 'u', 'f', 't', 'c', 'd', 'i'];
const invalid = () => new ApiError(400, 'VALIDATION_FAILED', 'cursor is invalid or does not match this transaction list');

function payload(context, boundary) {
  return {
    v: 1, u: context.userId, f: context.from, t: context.to,
    c: context.category, d: boundary.spent_on, i: boundary.id,
  };
}

function encodeCursor(context, boundary) {
  return Buffer.from(JSON.stringify(payload(context, boundary))).toString('base64url');
}

function decodeCursor(raw, context) {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_CURSOR_LENGTH ||
      !/^[A-Za-z0-9_-]+$/.test(raw)) throw invalid();
  let parsed;
  try { parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')); }
  catch { throw invalid(); }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed) ||
      JSON.stringify(Object.keys(parsed)) !== JSON.stringify(KEYS) ||
      parsed.v !== 1 || parsed.u !== context.userId ||
      parsed.f !== context.from || parsed.t !== context.to ||
      parsed.c !== context.category || !isValidDate(parsed.d) ||
      parsed.d < context.from || parsed.d > context.to ||
      !Number.isSafeInteger(parsed.i) || parsed.i <= 0 ||
      encodeCursor(context, { spent_on: parsed.d, id: parsed.i }) !== raw) throw invalid();
  return { spent_on: parsed.d, id: parsed.i };
}

module.exports = { encodeCursor, decodeCursor, MAX_CURSOR_LENGTH };

'use strict';

// Per-user settings — currently one figure, monthly income (spec §3, D-021).
//
// A module rather than something hanging off the route, because the summary
// route needs to read income too. S01 already made the mistake of exporting a
// helper by attaching it to an Express router; D-005 records why that is the
// wrong shape, and this is the same situation.

const { db } = require('./db');

/**
 * A user may have no settings row at all, which is the normal state of a fresh
 * account. Rather than making every caller handle that, "no row" and "zero" are
 * the same answer: nothing has been set. Zero can mean nothing else, because §3
 * forbids a negative income.
 */
function readSettings(userId) {
  const row = db
    .prepare('SELECT monthly_income_cents, monthly_limit_cents FROM settings WHERE user_id = ?')
    .get(userId);
  return {
    monthly_income_cents: row ? row.monthly_income_cents : 0,
    // No row, or a row from before the limit existed, both mean "no limit set"
    // — which is not the same as a limit of zero.
    monthly_limit_cents: row && row.monthly_limit_cents !== null && row.monthly_limit_cents !== undefined
      ? row.monthly_limit_cents
      : null,
  };
}

function readIncome(userId) {
  return readSettings(userId).monthly_income_cents;
}

/**
 * Write the income, and the limit only when the caller said something about it.
 *
 * `limitCents` is `undefined` when the field was absent, which means "leave it
 * as it is"; `null` clears it; a number sets it. Keeping the three apart here
 * is what makes an ordinary income save stop wiping a limit somebody set.
 */
function writeSettings(userId, { incomeCents, limitCents }) {
  // One statement rather than read-then-branch: the row either does not exist
  // or is being replaced, and both of those are the same write.
  if (limitCents === undefined) {
    db.prepare(
      `INSERT INTO settings (user_id, monthly_income_cents) VALUES (?, ?)
       ON CONFLICT (user_id) DO UPDATE SET monthly_income_cents = excluded.monthly_income_cents`
    ).run(userId, incomeCents);
  } else {
    db.prepare(
      `INSERT INTO settings (user_id, monthly_income_cents, monthly_limit_cents) VALUES (?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET monthly_income_cents = excluded.monthly_income_cents,
                                           monthly_limit_cents  = excluded.monthly_limit_cents`
    ).run(userId, incomeCents, limitCents);
  }
  return readSettings(userId);
}

/**
 * The month judged against the limit — the decision table in
 * qa/docs/analysis-monthly-limit.md §3, and the only place it is implemented.
 *
 * Computed on read, never stored (assumption A5): a stored judgement is wrong
 * the moment the next expense is added. Exactly at the limit is `reached`, not
 * `exceeded` (A4): spending the whole budget is not overspending.
 */
function limitState(limitCents, totalCents) {
  if (limitCents === null || limitCents === undefined) {
    return { limit_cents: null, limit_status: 'not_set', limit_remaining_cents: null };
  }
  const status = totalCents < limitCents ? 'within' : totalCents === limitCents ? 'reached' : 'exceeded';
  return {
    limit_cents: limitCents,
    limit_status: status,
    limit_remaining_cents: limitCents - totalCents,
  };
}

module.exports = { readSettings, readIncome, writeSettings, limitState };

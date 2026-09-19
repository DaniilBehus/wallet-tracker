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
function readIncome(userId) {
  const row = db
    .prepare('SELECT monthly_income_cents FROM settings WHERE user_id = ?')
    .get(userId);
  return row ? row.monthly_income_cents : 0;
}

function writeIncome(userId, cents) {
  // One statement rather than read-then-branch: the row either does not exist
  // or is being replaced, and both of those are the same write.
  db.prepare(
    `INSERT INTO settings (user_id, monthly_income_cents) VALUES (?, ?)
     ON CONFLICT (user_id) DO UPDATE SET monthly_income_cents = excluded.monthly_income_cents`
  ).run(userId, cents);
  return readIncome(userId);
}

module.exports = { readIncome, writeIncome };

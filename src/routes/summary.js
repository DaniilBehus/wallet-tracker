'use strict';

const express = require('express');
const { db } = require('../db');
const { monthBounds, currentMonth } = require('../dates');
const { readIncome } = require('../settings');
const v = require('../validate');

const router = express.Router();

// GET /api/summary?month=YYYY-MM
router.get('/', (req, res) => {
  const month = req.query.month === undefined ? currentMonth() : String(req.query.month);
  const bounds = monthBounds(month);
  if (!bounds) throw v.badRequest('month must be in YYYY-MM form');

  const params = [req.userId, bounds.from, bounds.to];

  const { total_cents: totalCents } = db
    .prepare(
      `SELECT COALESCE(SUM(amount_cents), 0) AS total_cents
       FROM transactions
       WHERE user_id = ? AND spent_on >= ? AND spent_on <= ?`
    )
    .get(...params);

  // LEFT JOIN, not JOIN: a transaction whose category was deleted still counts
  // towards the month total, so it must still appear in the breakdown rather
  // than making the parts stop summing to the whole.
  const byCategory = db
    .prepare(
      `SELECT t.category_id AS category_id,
              c.name        AS name,
              SUM(t.amount_cents) AS total_cents
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = ? AND t.spent_on >= ? AND t.spent_on <= ?
       GROUP BY t.category_id
       ORDER BY total_cents DESC`
    )
    .all(...params);

  // Computed on read, never stored (spec §5, D-021). A stored balance is wrong
  // the moment the next expense is added — the same reason next_due is not
  // stored. It may be negative: spending more than you earned is a fact, not an
  // error, and hiding it behind a zero would be the app lying to be polite.
  const incomeCents = readIncome(req.userId);

  res.status(200).json({
    month,
    total_cents: totalCents,
    income_cents: incomeCents,
    remaining_cents: incomeCents - totalCents,
    by_category: byCategory,
  });
});

module.exports = router;

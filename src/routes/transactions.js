'use strict';

const crypto = require('crypto');
const express = require('express');
const { db } = require('../db');
const { monthBounds, currentMonth, isValidDate } = require('../dates');
const v = require('../validate');
const { ApiError } = require('../errors');

const router = express.Router();

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const SELECT_COLUMNS =
  'id, amount_cents, category_id, spent_on, note, schedule_id, created_at';

// ------------------------------------------------------ keyed saves (D-035)

const KEY_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

const findKeyed = db.prepare(
  'SELECT payload_hash, transaction_id, response_json FROM transaction_requests WHERE user_id = ? AND operation_key = ?'
);
const storeKeyed = db.prepare(
  `INSERT INTO transaction_requests (user_id, operation_key, payload_hash, transaction_id, response_json)
   VALUES (?, ?, ?, ?, ?)`
);
const transactionExists = db.prepare('SELECT 1 FROM transactions WHERE id = ? AND user_id = ?');

/**
 * The identity of a save operation's content, independent of JSON key order:
 * [amount_cents, category_id or null, spent_on, note or null], after the same
 * shape validation the insert uses. Date bounds and category ownership are NOT
 * part of the fingerprint — they are checked only when the operation is new.
 */
function canonicalPayload(body) {
  const amount = v.amountCents(body.amount_cents);
  let category = null;
  if (body.category_id !== undefined && body.category_id !== null && body.category_id !== '') {
    category = v.id(body.category_id, 'category_id');
  }
  if (body.spent_on === undefined || body.spent_on === null) {
    throw v.badRequest('spent_on is required when an Idempotency-Key is sent');
  }
  if (!isValidDate(body.spent_on)) throw v.badRequest('spent_on must be a date in YYYY-MM-DD form');
  const note = body.note === undefined || body.note === null ? null : String(body.note);
  const canonical = JSON.stringify([amount, category, body.spent_on, note]);
  return { hash: crypto.createHash('sha256').update(canonical).digest('hex') };
}

const keyedSave = db.transaction((userId, key, body, hash) => {
  const existing = findKeyed.get(userId, key);
  if (existing) {
    if (existing.payload_hash !== hash) {
      throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'This Idempotency-Key was already used for a different expense');
    }
    if (!transactionExists.get(existing.transaction_id, userId)) {
      throw new ApiError(409, 'IDEMPOTENCY_REPLAY_UNAVAILABLE', 'The expense saved with this key no longer exists');
    }
    return { replayed: true, body: JSON.parse(existing.response_json) };
  }

  // A new operation: the ordinary validation, including the time-sensitive
  // date bound and current category ownership.
  const categoryId = v.ownedCategoryId(body.category_id, userId);
  const spentOn = v.spentOn(body.spent_on);
  const amountCents = v.amountCents(body.amount_cents);
  const note = body.note === undefined || body.note === null ? null : String(body.note);

  const info = db
    .prepare(
      `INSERT INTO transactions (user_id, amount_cents, category_id, spent_on, note)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(userId, amountCents, categoryId, spentOn, note);
  const created = db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM transactions WHERE id = ?`)
    .get(Number(info.lastInsertRowid));

  // Same transaction: the expense and its key exist together or not at all.
  storeKeyed.run(userId, key, hash, created.id, JSON.stringify(created));
  return { replayed: false, body: created };
});

// POST /api/transactions
router.post('/', (req, res) => {
  const body = req.body || {};

  const key = req.get('Idempotency-Key');
  if (key !== undefined) {
    if (!KEY_PATTERN.test(key)) {
      throw v.badRequest('Idempotency-Key must be 8-64 characters of letters, digits and hyphens');
    }
    const { hash } = canonicalPayload(body);
    // BEGIN IMMEDIATE: two requests with the same key serialise here, and the
    // second one finds the first one's row (R12).
    const outcome = keyedSave.immediate(req.userId, key, body, hash);
    if (outcome.replayed) res.set('Idempotency-Replayed', 'true');
    return res.status(201).json(outcome.body);
  }

  const amountCents = v.amountCents(body.amount_cents);
  const categoryId = v.ownedCategoryId(body.category_id, req.userId);
  const spentOn = v.spentOn(body.spent_on);
  const note = body.note === undefined || body.note === null ? null : String(body.note);

  const info = db
    .prepare(
      `INSERT INTO transactions (user_id, amount_cents, category_id, spent_on, note)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(req.userId, amountCents, categoryId, spentOn, note);

  const created = db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM transactions WHERE id = ?`)
    .get(Number(info.lastInsertRowid));

  res.status(201).json(created);
});

// GET /api/transactions?from=&to=&category_id=&limit=&offset=
router.get('/', (req, res) => {
  const thisMonth = monthBounds(currentMonth());

  const from = req.query.from === undefined ? thisMonth.from : req.query.from;
  const to = req.query.to === undefined ? thisMonth.to : req.query.to;
  if (!isValidDate(from)) throw v.badRequest('from must be a date in YYYY-MM-DD form');
  if (!isValidDate(to)) throw v.badRequest('to must be a date in YYYY-MM-DD form');
  if (from > to) throw v.badRequest('from must not be later than to');

  const limit = v.positiveIntParam(req.query.limit, {
    fallback: DEFAULT_LIMIT,
    max: MAX_LIMIT,
    field: 'limit',
  });
  const offset = v.positiveIntParam(req.query.offset, { fallback: 0, field: 'offset' });

  const where = ['user_id = ?', 'spent_on >= ?', 'spent_on <= ?'];
  const params = [req.userId, from, to];

  if (req.query.category_id !== undefined) {
    where.push('category_id = ?');
    params.push(v.ownedCategoryId(req.query.category_id, req.userId));
  }

  const clause = where.join(' AND ');
  const total = db
    .prepare(`SELECT COUNT(*) AS n FROM transactions WHERE ${clause}`)
    .get(...params).n;

  // Newest first, as the "This month" screen lists them (spec §6.2).
  const items = db
    .prepare(
      `SELECT ${SELECT_COLUMNS} FROM transactions WHERE ${clause}
       ORDER BY spent_on DESC, id DESC LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  res.status(200).json({ items, total });
});

// What a client may change, and what it may not (spec §5, D-029).
const EDITABLE = ['amount_cents', 'category_id', 'spent_on', 'note'];
const SERVER_OWNED = ['id', 'user_id', 'schedule_id', 'created_at'];

// PATCH /api/transactions/:id
router.patch('/:id', (req, res) => {
  const id = v.id(req.params.id, 'id');
  const body = req.body || {};
  const given = v.patchFields(body, { allowed: EDITABLE, serverOwned: SERVER_OWNED });

  // Every field goes through the same validator the create path uses. Two
  // validators for one column is how a rule that holds on POST stops holding
  // on PATCH, and nothing would notice until the data was already wrong.
  const sets = [];
  const params = [];
  const set = (column, value) => { sets.push(`${column} = ?`); params.push(value); };

  if (given.includes('amount_cents')) set('amount_cents', v.amountCents(body.amount_cents));
  if (given.includes('category_id')) set('category_id', v.ownedCategoryId(body.category_id, req.userId));
  if (given.includes('spent_on')) {
    // On create, an absent spent_on means "today". On edit, an explicit null is
    // not the same request — it is a client sending a value it does not have.
    if (body.spent_on === null) throw v.badRequest('spent_on must be a date in YYYY-MM-DD form');
    set('spent_on', v.spentOn(body.spent_on));
  }
  if (given.includes('note')) {
    set('note', body.note === null ? null : String(body.note));
  }

  // The user_id in the WHERE clause is what makes another user's row answer
  // 404 rather than 403 (spec §4.3) — the update simply matches nothing, and
  // "not yours" and "not there" become the same outcome.
  const info = db
    .prepare(`UPDATE transactions SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`)
    .run(...params, id, req.userId);

  if (info.changes === 0) throw v.notFound(`No transaction with id ${id}`);

  res.status(200).json(
    db.prepare(`SELECT ${SELECT_COLUMNS} FROM transactions WHERE id = ?`).get(id)
  );
});

// DELETE /api/transactions/:id
router.delete('/:id', (req, res) => {
  const id = v.id(req.params.id, 'id');
  const info = db
    .prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?')
    .run(id, req.userId);

  // Another user's row is indistinguishable from a row that does not exist.
  if (info.changes === 0) throw v.notFound(`No transaction with id ${id}`);
  res.status(204).end();
});

module.exports = router;

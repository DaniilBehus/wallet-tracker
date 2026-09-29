'use strict';

const crypto = require('crypto');
const express = require('express');
const { db } = require('../db');
const v = require('../validate');
const { isValidDate } = require('../dates');
const transactions = require('./transactions');

const router = express.Router();
const SOURCE = 'synthetic-demo-v1';
const findCategory = db.prepare('SELECT id FROM categories WHERE user_id = ? AND name = ?');
const own = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function exactKeys(value, required, optional = []) {
  if (!own(value)) throw v.badRequest('Expected a JSON object');
  const keys = Object.keys(value);
  if (required.some(key => !Object.hasOwn(value, key)) ||
      keys.some(key => !required.includes(key) && !optional.includes(key))) {
    throw v.badRequest('Import fields are missing or unsupported');
  }
}

function normalise(body) {
  exactKeys(body, ['source', 'records']);
  if (body.source !== SOURCE) throw v.badRequest('Unsupported synthetic source');
  if (!Array.isArray(body.records) || body.records.length < 1 || body.records.length > 10) {
    throw v.badRequest('records must contain 1–10 entries');
  }
  const seen = new Set();
  return body.records.map(record => {
    exactKeys(record, ['external_id', 'amount_cents', 'spent_on', 'category_name'], ['note']);
    if (typeof record.external_id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(record.external_id)) {
      throw v.badRequest('external_id must be 1–64 ASCII letters, digits, underscores or hyphens');
    }
    if (seen.has(record.external_id)) throw v.badRequest('Duplicate external_id in batch');
    seen.add(record.external_id);
    const amount = v.amountCents(record.amount_cents);
    if (!isValidDate(record.spent_on)) throw v.badRequest('spent_on must be a date in YYYY-MM-DD form');
    const spentOn = v.spentOn(record.spent_on);
    if (typeof record.category_name !== 'string' || !record.category_name.trim() || record.category_name.length > 60) {
      throw v.badRequest('category_name must be a non-empty name of at most 60 characters');
    }
    const note = record.note === undefined || record.note === null ? null : record.note;
    if (note !== null && (typeof note !== 'string' || note.length > 160)) {
      throw v.badRequest('note must be a string of at most 160 characters or null');
    }
    const keyHash = crypto.createHash('sha256').update(`${SOURCE}\0${record.external_id}`).digest('hex');
    // Underscore is intentionally outside the public Idempotency-Key alphabet:
    // an ordinary keyed expense cannot pre-claim an import identity.
    const key = `import_${keyHash.slice(0, 57)}`;
    const hash = crypto.createHash('sha256')
      .update(JSON.stringify([amount, spentOn, record.category_name, note])).digest('hex');
    return { external_id: record.external_id, amount_cents: amount, spent_on: spentOn,
      category_name: record.category_name, note, key, hash };
  });
}

function examine(userId, item) {
  const prior = transactions.lookupKeyed(userId, item.key, item.hash);
  if (prior) return { prior, categoryId: null };
  const category = findCategory.get(userId, item.category_name);
  if (!category) throw v.notFound('No owned category with the supplied name');
  return { prior: null, categoryId: category.id };
}

// No write, including to the retry ledger. A client must still explicitly
// confirm, and confirm revalidates because the data may change after preview.
router.post('/preview', (req, res) => {
  const records = normalise(req.body).map(item => {
    const { prior, categoryId } = examine(req.userId, item);
    return { external_id: item.external_id, amount_cents: item.amount_cents,
      spent_on: item.spent_on, category_name: item.category_name, note: item.note,
      category_id: categoryId, state: prior ? 'already_imported' : 'new',
      transaction_id: prior ? prior.transaction_id : null };
  });
  res.status(200).json({ source: SOURCE, records });
});

const confirmBatch = db.transaction((userId, items) => items.map(item => {
  const { categoryId } = examine(userId, item);
  const outcome = transactions.saveImported(userId, item.key, {
    amount_cents: item.amount_cents, category_id: categoryId,
    spent_on: item.spent_on, note: item.note,
  }, item.hash);
  return { external_id: item.external_id, transaction_id: outcome.body.id, replayed: outcome.replayed };
}));

router.post('/confirm', (req, res) => {
  const items = normalise(req.body);
  const records = confirmBatch.immediate(req.userId, items);
  res.status(records.every(item => item.replayed) ? 200 : 201).json({ source: SOURCE, records });
});

module.exports = router;

'use strict';

const express = require('express');
const { db } = require('../db');
const v = require('../validate');

const router = express.Router();

// GET /api/categories
router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT id, name, icon, monthly_limit_cents FROM categories WHERE user_id = ? ORDER BY id')
    .all(req.userId);
  res.status(200).json(rows);
});

// POST /api/categories
router.post('/', (req, res) => {
  const body = req.body || {};
  const name = v.name(body.name);
  const icon = body.icon === undefined || body.icon === null ? null : String(body.icon);

  const duplicate = db
    .prepare('SELECT id FROM categories WHERE user_id = ? AND name = ?')
    .get(req.userId, name);
  if (duplicate) throw v.conflict(`A category named "${name}" already exists`);

  const info = db
    .prepare('INSERT INTO categories (user_id, name, icon) VALUES (?, ?, ?)')
    .run(req.userId, name, icon);

  res.status(201).json({ id: Number(info.lastInsertRowid), name, icon, monthly_limit_cents: null });
});

// PATCH /api/categories/:id — the limit alone, never name/icon or ownership.
router.patch('/:id', (req, res) => {
  const categoryId = v.id(req.params.id, 'id');
  const body = req.body;
  v.patchFields(body, {
    allowed: ['monthly_limit_cents'],
    serverOwned: ['id', 'user_id', 'created_at'],
  });
  const limit = v.limitCents(body.monthly_limit_cents);
  const changed = db.prepare(
    'UPDATE categories SET monthly_limit_cents = ? WHERE id = ? AND user_id = ?'
  ).run(limit, categoryId, req.userId);
  if (!changed.changes) throw v.notFound(`No category with id ${categoryId}`);
  const category = db.prepare(
    'SELECT id, name, icon, monthly_limit_cents FROM categories WHERE id = ? AND user_id = ?'
  ).get(categoryId, req.userId);
  res.status(200).json(category);
});

module.exports = router;

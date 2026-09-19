'use strict';

const express = require('express');
const { db } = require('../db');
const v = require('../validate');

const router = express.Router();

// GET /api/categories
router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT id, name, icon FROM categories WHERE user_id = ? ORDER BY id')
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

  res.status(201).json({ id: Number(info.lastInsertRowid), name, icon });
});

module.exports = router;

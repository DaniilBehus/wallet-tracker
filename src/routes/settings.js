'use strict';

const express = require('express');
const { readIncome, writeIncome } = require('../settings');
const v = require('../validate');

const router = express.Router();

// GET /api/settings
router.get('/', (req, res) => {
  res.status(200).json({ monthly_income_cents: readIncome(req.userId) });
});

// PUT /api/settings
router.put('/', (req, res) => {
  const body = req.body || {};
  const income = v.incomeCents(body.monthly_income_cents);
  res.status(200).json({ monthly_income_cents: writeIncome(req.userId, income) });
});

module.exports = router;

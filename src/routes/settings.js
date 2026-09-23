'use strict';

const express = require('express');
const { readSettings, writeSettings } = require('../settings');
const v = require('../validate');

const router = express.Router();

// GET /api/settings
router.get('/', (req, res) => {
  res.status(200).json(readSettings(req.userId));
});

// PUT /api/settings
//
// The income is required, as it always was. The limit is optional and has three
// answers: a number sets it, null clears it, and leaving the field out keeps
// whatever is stored (qa/docs/analysis-monthly-limit.md, REQ-ML-01…03).
router.put('/', (req, res) => {
  const body = req.body || {};
  const incomeCents = v.incomeCents(body.monthly_income_cents);
  const limitCents = v.limitCents(body.monthly_limit_cents);
  res.status(200).json(writeSettings(req.userId, { incomeCents, limitCents }));
});

module.exports = router;

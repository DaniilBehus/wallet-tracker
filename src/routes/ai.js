'use strict';

// GET  /api/ai/capabilities
// POST /api/ai/expense-draft
// Both mounted behind requireAuth in server.js (spec/ai-expense-entry.md §4).
//
// The route returns a DRAFT. It has no access to a transaction write path; the
// only way an expense is stored is the ordinary POST /api/transactions after the
// person reviews the draft and presses Save (AI-R01, AI-R02).

const express = require('express');
const { db } = require('../db');
const { loadConfig } = require('../ai/config');
const { resolveProvider, unavailableMessage } = require('../ai/provider');
const { createLimits } = require('../ai/limits');
const { createDraftService } = require('../ai/service');

const router = express.Router();

const config = loadConfig(process.env);
for (const warning of config.warnings) console.warn(`[ai] ${warning}`);
if (config.provider === 'gemini') {
  // D-040: Gemini Free may use prompts to improve Google products.
  console.warn('[ai] WALLET_AI_PROVIDER=gemini is for synthetic evaluation only; the application will not use it');
} else if (config.mode === 'live' && !config.liveReady) {
  // Names of what is missing, never values.
  console.warn(`[ai] live mode requested but not enabled; missing: ${config.missing.join(', ')}`);
}

const clock = { now: () => new Date() };
const limits = createLimits({ db, limits: config.limits, clock });
const service = createDraftService({
  db,
  getProvider: () => resolveProvider(config),
  limits,
  clock,
  log: (entry) => console.log(JSON.stringify(entry)),
  unavailableMessage: () => unavailableMessage(config),
});

// GET /api/ai/capabilities
router.get('/capabilities', (req, res) => {
  res.status(200).json(service.capabilities());
});

// POST /api/ai/expense-draft
router.post('/expense-draft', async (req, res) => {
  // A person who closes the dialog closes the connection; stop waiting for the
  // provider. This reduces waiting, it does not guarantee no upstream work.
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableFinished) controller.abort();
  });

  const draft = await service.createDraft({
    userId: req.userId,
    body: req.body,
    rawBytes: req.rawBodyBytes,
    signal: controller.signal,
  });
  res.status(200).json(draft);
});

module.exports = router;

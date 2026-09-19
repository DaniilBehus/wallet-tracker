#!/usr/bin/env node
'use strict';

/*
 * The offline AI test layer.
 *
 *   npm run test:ai
 *
 * Runs every qa/ai/tests/*.test.js with node:test, with the network guard
 * preloaded and an environment that cannot switch a real provider on:
 * OPENAI_*, GEMINI_*, GOOGLE_* and WALLET_AI_* are removed before the
 * child starts (support/test-env.js). A key
 * in the developer's shell, a CI secret or .env therefore changes nothing here.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { scrubbedEnv } = require('./support/test-env');

const ROOT = path.join(__dirname, '..', '..');
const TESTS = path.join(__dirname, 'tests');
const GUARD = path.join(__dirname, 'support', 'no-network.js');

const files = fs.readdirSync(TESTS)
  .filter((name) => name.endsWith('.test.js'))
  .sort()
  .map((name) => path.join('qa', 'ai', 'tests', name));

if (files.length === 0) {
  console.error('qa/ai: no test files found');
  process.exit(1);
}

const env = scrubbedEnv(process.env);

const result = spawnSync(process.execPath, ['--require', GUARD, '--test', '--test-concurrency=1', ...files], {
  cwd: ROOT,
  env,
  stdio: 'inherit',
});

if (result.error) {
  console.error(`qa/ai: could not start node --test: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status === null ? 1 : result.status);

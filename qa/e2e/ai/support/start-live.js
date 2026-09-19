'use strict';

// Web server for the AI browser suite (playwright.ai.config.js).
//
// One process: the fake OpenAI endpoint, controlled over HTTP by the specs,
// and the real Wallet server in live mode whose real adapter is pointed at it.
// A throwaway database per start; the network guard is loaded first, so a
// mistake here cannot reach a real provider.

require('../../../ai/support/no-network');

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const { createFakeOpenAI } = require('../../../ai/support/fake-openai');

const WALLET_PORT = Number(process.env.QA_AI_E2E_PORT || 3021);
const FAKE_PORT = Number(process.env.QA_AI_FAKE_PORT || 3022);

async function main() {
  const fake = createFakeOpenAI();
  const fakeUrl = await fake.listen(FAKE_PORT);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-ai-e2e-'));
  process.on('exit', () => fs.rmSync(dir, { recursive: true, force: true }));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit(0));

  for (const name of Object.keys(process.env)) {
    if (/^(OPENAI_|WALLET_AI_)/i.test(name)) delete process.env[name];
  }
  Object.assign(process.env, {
    PORT: String(WALLET_PORT),
    DB_PATH: path.join(dir, 'wallet.db'),
    JWT_SECRET: crypto.randomBytes(48).toString('hex'),
    LOGIN_WINDOW_MS: '1000',
    WALLET_AI_MODE: 'live',
    WALLET_AI_TEST_FAKE_URL: fakeUrl,
    WALLET_AI_TIMEOUT_MS: '5000',
    WALLET_AI_GLOBAL_DAILY_CALLS: '10000',
    WALLET_AI_USER_DAILY_CALLS: '1000',
    WALLET_AI_USER_MINUTE_CALLS: '100',
    WALLET_AI_MAX_CONCURRENT: '20',
  });
  require('../../../ai/support/test-server');
}

main().catch((err) => {
  console.error(`AI e2e server failed: ${err.message}`);
  process.exit(1);
});

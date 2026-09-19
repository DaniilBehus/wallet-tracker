'use strict';

const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

/**
 * WALLET · AI expense entry browser suite.
 *
 *   npm run test:ai:e2e
 *
 * Separate from playwright.config.js on purpose:
 *
 *   * its own servers — a live-mode Wallet whose real OpenAI adapter talks to a
 *     local fake the specs control over HTTP, and the `npm run ai:demo` runner;
 *   * one worker — every spec shares the one fake, and a queued answer meant
 *     for one test must not be consumed by another.
 *
 * The same rules as the main suite otherwise: web-first assertions, no sleeps,
 * locators by test id or role (D-012, D-013).
 */

const LIVE_PORT = Number(process.env.QA_AI_E2E_PORT || 3021);
const FAKE_PORT = Number(process.env.QA_AI_FAKE_PORT || 3022);
const DEMO_PORT = Number(process.env.QA_AI_DEMO_PORT || 3023);

process.env.QA_AI_FAKE_URL = `http://127.0.0.1:${FAKE_PORT}`;
process.env.QA_AI_DEMO_URL = `http://localhost:${DEMO_PORT}`;

module.exports = defineConfig({
  testDir: './qa/e2e/ai',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { outputFolder: 'qa/reports/playwright-ai', open: 'never' }]],
  outputDir: 'test-results/ai',

  use: {
    baseURL: `http://localhost:${LIVE_PORT}`,
    testIdAttribute: 'data-testid',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'] } },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: [
    {
      command: `node ${JSON.stringify(path.join(__dirname, 'qa', 'e2e', 'ai', 'support', 'start-live.js'))}`,
      url: `http://localhost:${LIVE_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 60 * 1000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: { QA_AI_E2E_PORT: String(LIVE_PORT), QA_AI_FAKE_PORT: String(FAKE_PORT) },
    },
    {
      command: `node ${JSON.stringify(path.join(__dirname, 'qa', 'ai', 'demo.js'))}`,
      url: `http://localhost:${DEMO_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 60 * 1000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: {
        AI_DEMO_PORT: String(DEMO_PORT),
        AI_DEMO_DIR: path.join(__dirname, 'qa', 'reports', 'ai-demo-e2e'),
      },
    },
  ],
});

'use strict';

const { defineConfig, devices } = require('@playwright/test');
const { randomUUID } = require('node:crypto');

// The parent runner starts a fresh database and a loopback-only server, then
// stops that server before removing its own database directory. Direct
// Playwright invocation must not silently fall back to a development server.
if (process.env.QA_E2E_MANAGED !== '1') {
  throw new Error('Main E2E requires the managed runner: npm run test:e2e');
}
const BASE_URL = process.env.QA_E2E_BASE_URL;
const target = new URL(BASE_URL);
if (target.protocol !== 'http:' || target.hostname !== '127.0.0.1' ||
    !target.port || target.pathname !== '/' || target.search || target.hash) {
  throw new Error('Main E2E target must be the managed loopback server');
}
const reporters = [
  ['list'],
  ['html', { outputFolder: 'playwright-report', open: 'never' }],
  // A new identity for every config load prevents a failed startup from
  // masquerading as an older local PASS artifact at a fixed filename.
  ['json', { outputFile: `qa/reports/playwright-main/results-${randomUUID()}.json` }],
];

/**
 * WALLET · end-to-end configuration.
 *
 * The parent runner waits for the local server's readiness. Specs use web-first
 * assertions, not fixed sleeps; CI keeps one retry for a diagnostic trace.
 */
module.exports = defineConfig({
  testDir: './qa/e2e',
  // The AI suite has its own config and servers (playwright.ai.config.js);
  // it must not run here without them.
  testIgnore: ['**/ai/**'],

  // Specs create separate users, but intentionally share one disposable server,
  // database and IP-based login limiter within this run.
  fullyParallel: true,

  // Keep one diagnostic CI retry, but a retry-only pass is flaky, not clean.
  // The first failed attempt is traced and retained for investigation; neither
  // a retry nor a trace proves the cause was infrastructure.
  retries: process.env.CI ? 1 : 0,
  failOnFlakyTests: !!process.env.CI,
  forbidOnly: !!process.env.CI,
  workers: process.env.CI ? 2 : undefined,

  reporter: reporters,
  outputDir: 'test-results/main',

  use: {
    baseURL: BASE_URL,

    // The attribute the application already carries (spec §6.5). Setting it
    // explicitly rather than relying on the default documents the coupling.
    testIdAttribute: 'data-testid',

    // Retain the FIRST failed attempt, even if a later retry passes: open it
    // with `npx playwright show-trace`.
    trace: 'retain-on-first-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      // The application is phone-first (spec §6), so the phone viewport is the
      // one that runs by default rather than an afterthought.
      name: 'mobile-chromium',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

});

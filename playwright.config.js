'use strict';

const path = require('path');
const crypto = require('crypto');
const { defineConfig, devices } = require('@playwright/test');

// Its own port and its own database, like the API and load runners. Three
// reasons, and the third is new: rate limiting (D-016) counts failed logins per
// client IP, every test here comes from 127.0.0.1, and the suite has a
// wrong-password case. Sharing a server with development would mean the third
// full run of the day starts getting 429 where it expects 401 — a test that
// fails because of an earlier test, which is the exact class of flakiness this
// project has refused everywhere else.
const PORT = Number(process.env.QA_E2E_PORT || 3002);
const BASE_URL = process.env.QA_BASE_URL || `http://localhost:${PORT}`;
const reporters = [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]];

/**
 * WALLET · end-to-end configuration.
 *
 * The waiting strategy is the load-bearing choice here: web-first assertions
 * only, no fixed sleeps anywhere. Everything below follows from that — the retry count exists so
 * `trace: 'on-first-retry'` has a first retry to attach itself to, and the
 * webServer block exists so no test ever has to wait for a server by guessing.
 */
module.exports = defineConfig({
  testDir: './qa/e2e',
  // The AI suite has its own config and servers (playwright.ai.config.js);
  // it must not run here without them.
  testIgnore: ['**/ai/**'],

  // Specs share nothing: each creates its own user through the API, so they can
  // run in any order and in parallel. If this line ever has to come out, a spec
  // has grown a dependency on another one and that is the bug.
  fullyParallel: true,

  // A test that only passes on a retry locally is a test with a race in it, and
  // retries would hide it. In CI one retry is allowed, purely so a genuinely
  // flaky infrastructure moment produces a trace instead of a mystery.
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  workers: process.env.CI ? 2 : undefined,

  reporter: reporters,

  use: {
    baseURL: BASE_URL,

    // The attribute the application already carries (spec §6.5). Setting it
    // explicitly rather than relying on the default documents the coupling.
    testIdAttribute: 'data-testid',

    // A recording of everything the browser did, attached to the first retry.
    // This is what makes a failure that only happens in CI diagnosable: open it
    // with `npx playwright show-trace`.
    trace: 'on-first-retry',
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

  // Playwright starts the server and waits for /api/health to answer, so no
  // spec contains a sleep waiting for a boot. Locally it reuses whatever is
  // already listening on the port.
  webServer: {
    command: `node ${JSON.stringify(path.join(__dirname, 'src', 'server.js'))}`,
    url: `${BASE_URL}/api/health`,
    // Never reuse: a server started for something else has the production
    // rate-limit window and a database full of other things.
    reuseExistingServer: false,
    timeout: 60 * 1000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      PORT: String(PORT),
      DB_PATH: path.join(__dirname, 'data', 'e2e.db'),
      JWT_SECRET: process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex'),
      // One second, so the wrong-password case cannot leave a mark that the
      // next run trips over.
      LOGIN_WINDOW_MS: '1000',
    },
  },
});

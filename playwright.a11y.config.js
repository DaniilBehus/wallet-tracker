'use strict';

const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

const PORT = Number(process.env.QA_A11Y_PORT || 3041);

module.exports = defineConfig({
  testDir: './qa/a11y',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { outputFolder: 'qa/reports/playwright-a11y', open: 'never' }]],
  outputDir: 'test-results/a11y',
  use: {
    baseURL: `http://localhost:${PORT}`,
    testIdAttribute: 'data-testid',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'mobile-320x568', use: { ...devices['Pixel 5'], viewport: { width: 320, height: 568 } } },
    { name: 'desktop-1280x800', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  // The demo strips AI keys and loads a no-network guard. Its database and
  // generated reports stay under ignored qa/reports/, never the app's DB.
  webServer: {
    command: `node ${JSON.stringify(path.join(__dirname, 'qa', 'ai', 'demo.js'))}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 60 * 1000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      AI_DEMO_PORT: String(PORT),
      AI_DEMO_DIR: path.join(__dirname, 'qa', 'reports', 'a11y-demo'),
    },
  },
});

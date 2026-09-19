#!/usr/bin/env node
'use strict';

/*
 * Screenshots of the AI expense entry for the README and the case study.
 *
 *   npm run ai:screenshots
 *
 * Taken against `npm run ai:demo` on a throwaway folder, so every picture shows
 * the "Demo — sample responses, no AI service contacted" banner. None of them
 * is, or is labelled as, a live AI result. Chromium only; phone sizes are
 * emulated viewports, not physical devices.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { chromium, devices } = require('@playwright/test');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'docs', 'screenshots');

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function startDemo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-ai-shots-'));
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(__dirname, 'demo.js')], {
    cwd: ROOT,
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP, AI_DEMO_DIR: dir, AI_DEMO_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (d) => { output += d; });
  child.stderr.on('data', (d) => { output += d; });
  const deadline = Date.now() + 20000;
  for (;;) {
    const m = output.match(/listening on http:\/\/localhost:(\d+)/);
    if (m) return { child, dir, baseUrl: `http://localhost:${m[1]}` };
    if (child.exitCode !== null || Date.now() > deadline) throw new Error(`demo did not start:\n${output}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

async function signedInPage(browser, baseUrl, contextOptions) {
  const email = `shots-${Date.now()}-${Math.floor(Math.random() * 1e6)}@wallet.test`;
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'synthetic-password-1' }),
  });
  const { token } = await res.json();
  const context = await browser.newContext(contextOptions);
  await context.addInitScript((t) => window.localStorage.setItem('wallet_token', t), token);
  const page = await context.newPage();
  await page.goto(baseUrl);
  await page.getByTestId('ai-open').waitFor();
  return { page, context };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const demo = await startDemo();
  const browser = await chromium.launch();
  const written = [];
  const shot = async (page, name) => {
    const file = path.join(OUT, name);
    await page.screenshot({ path: file });
    written.push(path.relative(ROOT, file));
  };

  try {
    // 1 · the entry point on Add, and the describe step
    {
      const { page, context } = await signedInPage(browser, demo.baseUrl, { ...devices['Pixel 5'] });
      await shot(page, 'ai-1-add-entry.png');
      await page.getByTestId('ai-open').click();
      await page.getByTestId('ai-example-uk').click();
      await shot(page, 'ai-2-describe-demo.png');

      // 2 · a ready draft for review
      await page.getByTestId('ai-suggest').click();
      await page.getByTestId('ai-review').waitFor();
      await shot(page, 'ai-3-review-ready-demo.png');

      // 3 · a draft that needs input
      await page.getByTestId('ai-edit-description').click();
      await page.getByTestId('ai-text').fill('Lunch yesterday');
      await page.getByTestId('ai-suggest').click();
      await page.getByTestId('ai-amount-hint').waitFor();
      await shot(page, 'ai-4-review-needs-input-demo.png');
      await context.close();
    }

    // 4 · BUG-014: Add on the shortest supported phone
    {
      const { page, context } = await signedInPage(browser, demo.baseUrl, { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await shot(page, 'ai-5-add-320x568.png');
      await context.close();
    }
  } finally {
    await browser.close();
    const exited = new Promise((r) => demo.child.once('exit', r));
    demo.child.kill();
    await exited;
    fs.rmSync(demo.dir, { recursive: true, force: true });
  }

  for (const file of written) console.log(`wrote ${file}`);
}

main().catch((err) => {
  console.error(`ai:screenshots failed: ${err.message}`);
  process.exitCode = 1;
});

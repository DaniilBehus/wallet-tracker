#!/usr/bin/env node
'use strict';

/*
 * Regenerates the README screenshots.
 *
 *   npm run screenshots
 *
 * Written as a script rather than taken by hand for one reason: screenshots go
 * stale silently. A README showing an interface that no longer exists is worse
 * than one with no pictures, and the only defence is being able to redo them in
 * one command when the UI changes. D-018 is exactly that case: the interface
 * changed language and four pictures were instantly lying.
 *
 * Like the test runners (D-017) it starts a server of its own on its own port
 * with a throwaway database, so the pictures never contain real data and the
 * numbers in them are the same every time. Set QA_BASE_URL to point it at a
 * server that is already running instead.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { chromium, devices } = require('@playwright/test');

const ROOT = path.join(__dirname, '..');
const EXTERNAL_URL = process.env.QA_BASE_URL || null;
const PORT = Number(process.env.SHOTS_PORT || 3005);
const BASE_URL = EXTERNAL_URL || `http://localhost:${PORT}`;
const DB_PATH = path.join(ROOT, 'data', `shots-${Date.now()}.db`);
const OUT_DIR = path.join(ROOT, 'docs', 'screenshots');

function startServer() {
  const server = spawn(process.execPath, [path.join(ROOT, 'src', 'server.js')], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      DB_PATH,
      JWT_SECRET: crypto.randomBytes(48).toString('hex'),
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  server.on('error', (err) => {
    console.error(`could not start the server: ${err.message}`);
    process.exit(1);
  });
  return server;
}

async function cleanUp(server) {
  // On Windows the SQLite child may still have the database open after kill()
  // returns. Wait for its exit before removing only this run's throwaway files.
  if (server && server.exitCode === null && !server.killed) {
    const exited = new Promise((resolve) => server.once('exit', resolve));
    server.kill();
    await exited;
  }
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    fs.rmSync(DB_PATH + suffix, { force: true });
  }
}

async function waitForServer() {
  const deadline = Date.now() + 30000;
  let lastError = 'no attempt made';
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) return;
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`the server at ${BASE_URL} never became healthy (${lastError})`);
}

const pad2 = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const today = new Date();
const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);

// Kept inside the current month so everything lands on the "This month" screen;
// two distinct days so the day grouping from spec §6.2 is visible.
const TODAY = iso(today);
const YESTERDAY = iso(yesterday.getMonth() === today.getMonth() ? yesterday : today);

async function api(pathname, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(BASE_URL + pathname, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`${method} ${pathname} -> ${response.status} ${await response.text()}`);
  }
  return response.status === 204 ? null : response.json();
}

/** A month that looks like somebody's actual spending, not like test data. */
async function seed() {
  const stamp = Date.now();
  const { token } = await api('/api/auth/register', {
    method: 'POST',
    body: { email: `demo-${stamp}@wallet.test`, password: `demo-passphrase-${stamp}` },
  });

  const categories = await api('/api/categories', { token });
  const byName = new Map(categories.map((c) => [c.name, c.id]));

  // An income to measure the month against (D-021), set before the expenses so
  // the donut has a whole to divide.
  await api('/api/settings', {
    method: 'PUT',
    token,
    // A limit a little above the month below, so the picture shows the state
    // line rather than an empty "Set limit" control.
    body: { monthly_income_cents: 150000, monthly_limit_cents: 80000 },
  });

  // A month shaped like a real one: rent dominates, then food, then the rest.
  // Flat amounts would make every arc the same width and show nothing.
  const expenses = [
    { name: 'Housing', cents: 60000, on: YESTERDAY, note: 'Rent' },
    { name: 'Groceries', cents: 2340, on: TODAY, note: 'Lidl' },
    { name: 'Restaurants', cents: 1250, on: TODAY, note: 'Lunch' },
    { name: 'Transport', cents: 420, on: TODAY, note: null },
    { name: 'Other', cents: 4000, on: TODAY, note: 'new tyre' },
    { name: 'Groceries', cents: 1870, on: YESTERDAY, note: 'Billa' },
    { name: 'Health', cents: 890, on: YESTERDAY, note: 'Pharmacy' },
    { name: 'Entertainment', cents: 1500, on: YESTERDAY, note: 'Cinema' },
  ];

  for (const expense of expenses) {
    await api('/api/transactions', {
      method: 'POST',
      token,
      body: {
        amount_cents: expense.cents,
        category_id: byName.get(expense.name),
        spent_on: expense.on,
        note: expense.note,
      },
    });
  }

  await api('/api/schedules', {
    method: 'POST',
    token,
    body: {
      name: 'Telekom',
      amount_cents: 1500,
      category_id: byName.get('Phone & internet'),
      day_of_month: 12,
      starts_on: '2026-01-01',
    },
  });

  const loan = await api('/api/schedules', {
    method: 'POST',
    token,
    body: {
      name: 'Laptop loan',
      amount_cents: 10000,
      category_id: byName.get('Other'),
      day_of_month: 20,
      starts_on: '2026-01-01',
      total_count: 10,
    },
  });

  // Three paid of ten, so Upcoming reads "7 of 10 left" — the example spec §6.3
  // gives, and a better thing to show than a loan nobody has started.
  const payments = [];
  for (let i = 0; i < 3; i++) {
    payments.push(await api(`/api/schedules/${loan.id}/pay`, { method: 'PATCH', token }));
  }

  // Each payment writes a transaction dated today, so three of them land in the
  // same month and €300 of loan swamps the spending the month screen is for.
  // A loan three months in has had one payment *this* month, so the other two
  // are removed. The result is a state a real account could actually be in.
  for (const payment of payments.slice(0, 2)) {
    await api(`/api/transactions/${payment.transaction_id}`, { method: 'DELETE', token });
  }

  return token;
}

const SHOTS = [
  { file: '1-add.png', testid: 'nav-add', settle: 'category-tile-' },
  { file: '2-month.png', testid: 'nav-month', settle: 'month-total' },
  { file: '3-upcoming.png', testid: 'nav-upcoming', settle: 'schedule-row-' },
  { file: '4-schedules.png', testid: 'nav-schedules', settle: 'schedule-save-btn' },
];

async function capture() {
  const token = await seed();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...devices['Pixel 5'],
    deviceScaleFactor: 2,          // legible when GitHub scales the image down
  });

  await context.addInitScript((value) => {
    window.localStorage.setItem('wallet_token', value);
  }, token);

  const page = await context.newPage();
  await page.goto(BASE_URL);

  for (const shot of SHOTS) {
    await page.getByTestId(shot.testid).click();
    // Wait on something the screen renders rather than on a timer, for the same
    // reason the test suite does (D-013): a screenshot taken half-rendered is
    // worse than no screenshot.
    await page.getByTestId(new RegExp(`^${shot.settle}`)).first().waitFor();
    // A click leaves the pointer on the navigation. Its 160 ms hover fade can
    // otherwise appear under the previously active tab in the next picture.
    await page.mouse.move(0, 0);
    await page.waitForFunction(() => [...document.querySelectorAll('.nav__btn:not([aria-current="page"])')]
      .every((button) => !button.matches(':hover') &&
        getComputedStyle(button).backgroundColor === 'rgba(0, 0, 0, 0)'));
    await page.screenshot({ path: path.join(OUT_DIR, shot.file) });
    console.log(`wrote docs/screenshots/${shot.file}`);
  }

  await browser.close();
}

async function main() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const server = EXTERNAL_URL ? null : startServer();
  process.on('SIGINT', async () => {
    await cleanUp(server);
    process.exit(130);
  });

  try {
    await waitForServer();
    await capture();
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    await cleanUp(server);
  }
}

main();

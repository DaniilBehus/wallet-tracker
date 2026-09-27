#!/usr/bin/env node
'use strict';

/*
 * Generates docs/support/exercise.log, the log for docs/support/log-exercise.md.
 *
 *   node scripts/support-exercise.js
 *
 * A real run, not a written one. Like scripts/screenshots.js it starts the app
 * on its own port with a throwaway database, then drives a short session of use
 * through the API and keeps everything the server printed.
 *
 * One failure is planted: while one expense is saved, a second connection holds
 * the database's write lock, the way a backup tool or a database browser in the
 * middle of a change would. The save then fails for real, after the 5-second
 * busy timeout, and the app logs it as it would any unexpected error.
 *
 * The only change made to what the server printed: the app's own folder, which
 * appears in stack traces, is replaced by <app>, so the file carries no
 * machine's paths. Ids and times differ on every run, so regenerating the log
 * means updating the worked answer on the page; qa/python/test_log_exercise.py
 * fails until it is.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const Database = require('better-sqlite3');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.EXERCISE_PORT || 3007);
const BASE = `http://localhost:${PORT}`;
const OUT = path.join(ROOT, 'docs', 'support', 'exercise.log');

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function call(route, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, id: res.headers.get('x-request-id'), body: text ? JSON.parse(text) : null };
}

async function register(label) {
  const email = `${label}-${crypto.randomBytes(4).toString('hex')}@example.test`;
  const password = `exercise-${crypto.randomBytes(6).toString('hex')}`;
  const { body } = await call('/api/auth/register', { method: 'POST', body: { email, password } });
  const categories = (await call('/api/categories', { token: body.token })).body;
  const byName = new Map(categories.map((c) => [c.name, c.id]));
  return { email, password, token: body.token, byName };
}

/** The same folder written the ways a stack trace and JSON can spell it. */
function scrub(text) {
  const forms = new Set([ROOT, ROOT.replace(/\\/g, '/'), ROOT.replace(/\\/g, '\\\\')]);
  let out = text;
  for (const form of [...forms].sort((a, b) => b.length - a.length)) out = out.split(form).join('<app>');
  return out;
}

async function session(dbPath) {
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  const ana = await register('first');
  const ben = await register('second');
  await pause(300);

  // The second account sets itself up and records a few things.
  await call('/api/settings', { method: 'PUT', token: ben.token, body: { monthly_income_cents: 180000, monthly_limit_cents: 60000 } });
  for (const [name, cents, note] of [['Groceries', 2340, null], ['Transport', 420, null], ['Restaurants', 1250, 'Lunch']]) {
    await call('/api/transactions', { method: 'POST', token: ben.token, body: { amount_cents: cents, category_id: ben.byName.get(name), note } });
    await pause(250);
  }
  await call(`/api/summary?month=${today.slice(0, 7)}`, { token: ben.token });
  await pause(400);

  // Somebody keeps getting the first account's password wrong.
  for (let i = 0; i < 6; i++) {
    await call('/api/auth/login', { method: 'POST', body: { email: ana.email, password: `not-it-${i}` } });
    await pause(350);
  }
  await pause(500);

  // The planted failure: a second connection is writing to the database while
  // the first account saves an expense.
  const blocker = new Database(dbPath, { timeout: 1000 });
  blocker.exec('BEGIN IMMEDIATE');
  const failed = await call('/api/transactions', {
    method: 'POST', token: ana.token, body: { amount_cents: 1870, category_id: ana.byName.get('Groceries'), note: 'Billa' },
  });
  blocker.exec('ROLLBACK');
  blocker.close();
  await pause(1500);

  // The person tries again, and it works.
  const retried = await call('/api/transactions', {
    method: 'POST', token: ana.token, body: { amount_cents: 1870, category_id: ana.byName.get('Groceries'), note: 'Billa' },
  });
  await pause(400);

  // The second account tries the AI entry, which is switched off here.
  await call('/api/ai/expense-draft', {
    method: 'POST', token: ben.token,
    body: { text: 'coffee 3.20 eur', reference_date: today, locale: 'auto', consent_to_external_processing: true },
  });
  await pause(300);

  // And pays a subscription from Upcoming.
  const netflix = (await call('/api/schedules', {
    method: 'POST', token: ben.token,
    body: { name: 'Netflix', amount_cents: 1399, category_id: ben.byName.get('Entertainment'), day_of_month: 8, starts_on: '2026-01-01' },
  })).body;
  await call('/api/schedules', { token: ben.token });
  await call(`/api/schedules/${netflix.id}/pay`, { method: 'PATCH', token: ben.token });
  await pause(300);
  await call('/api/health');

  return { failed, retried };
}

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-exercise-'));
  const dbPath = path.join(dir, 'wallet.db');
  const server = spawn(process.execPath, [path.join(ROOT, 'src', 'server.js')], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), DB_PATH: dbPath, JWT_SECRET: crypto.randomBytes(48).toString('hex'),
           WALLET_AI_MODE: 'off', WALLET_REQUEST_LOG: 'on' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let printed = '';
  server.stdout.on('data', (d) => { printed += d; });
  server.stderr.on('data', (d) => { printed += d; });

  try {
    // Waiting for the server is not part of the exercise, so the ids of these
    // probes are kept and their lines left out of the file.
    const probes = [];
    for (let i = 0; ; i++) {
      try {
        const res = await fetch(`${BASE}/api/health`);
        probes.push(res.headers.get('x-request-id'));
        if (res.ok) break;
      } catch { /* not listening yet */ }
      if (i > 100) throw new Error(`the server on ${BASE} never became healthy:\n${printed}`);
      await pause(150);
    }

    const { failed, retried } = await session(dbPath);
    await pause(300);
    if (failed.status !== 500 || retried.status !== 201) {
      throw new Error(`the planted failure did not happen as intended: ${failed.status} then ${retried.status}`);
    }

    const kept = printed.split('\n').filter((line) => line.trim() && !probes.some((id) => id && line.includes(id)));
    fs.writeFileSync(OUT, scrub(kept.join('\n')) + '\n');
    console.log(`wrote ${path.relative(ROOT, OUT)}`);
    console.log(`planted failure: reference ${failed.id.slice(0, 8)} (${failed.id}); the retry: ${retried.id}`);
  } finally {
    const exited = new Promise((resolve) => server.once('exit', resolve));
    server.kill();
    await exited;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});

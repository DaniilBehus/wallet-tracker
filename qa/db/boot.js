#!/usr/bin/env node
'use strict';

/*
 * Boots the application's database layer against DB_PATH and prints what the
 * boot left behind, as JSON on stdout.
 *
 * A separate process on purpose: src/db.js reads DB_PATH and opens the file
 * once, at require time. Requiring it twice in one process would re-use the
 * first connection and prove nothing about a second boot, which is exactly what
 * the migration test needs to see.
 *
 *   node qa/db/boot.js                     boot only
 *   node qa/db/boot.js --set-limit=12000   boot, then store a limit for user 1
 *   node qa/db/boot.js --set-limit=null    boot, then clear it
 *
 * Nothing here reads .env, a key or a provider: it is the database layer alone.
 */

const { db } = require('../../src/db');
const { readSettings, writeSettings } = require('../../src/settings');

const USER_ID = 1;

const arg = process.argv.slice(2).find((a) => a.startsWith('--set-limit='));
if (arg) {
  const raw = arg.slice('--set-limit='.length);
  const current = readSettings(USER_ID);
  writeSettings(USER_ID, {
    incomeCents: current.monthly_income_cents,
    limitCents: raw === 'null' ? null : Number(raw),
  });
}

// table_info gives name, type, notnull and dflt_value — enough to say whether
// the column exists and whether it is nullable, which is the whole claim.
const columns = db.pragma('table_info(settings)').map((c) => ({
  name: c.name,
  type: c.type,
  notnull: c.notnull,
}));

const rows = db.prepare('SELECT user_id, monthly_income_cents, monthly_limit_cents FROM settings ORDER BY user_id').all();

process.stdout.write(JSON.stringify({ columns, rows, settings: readSettings(USER_ID) }));

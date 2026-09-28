'use strict';

/*
 * The additive limit migrations: settings and categories.monthly_limit_cents, added to a
 * database that was created before the monthly spending limit existed
 * (qa/docs/analysis-monthly-limit.md §6, RISK-ML-5).
 *
 * Why this file exists. schema.sql is re-applied on every boot and every
 * statement in it is CREATE TABLE IF NOT EXISTS, which means an existing
 * settings table is left exactly as it was — a new column inside that CREATE
 * would never appear in a database that already has the table. src/db.js
 * therefore adds the column with a guarded ALTER TABLE. That guard is the code
 * that upgrades a real person's database in place, and nothing else in the
 * suite exercises it: every other layer starts from an empty file, where the
 * column arrives with the CREATE and the ALTER never runs.
 *
 * Each boot is a child process, because src/db.js opens DB_PATH once at require
 * time. Each run works on a fresh temporary file of its own making, never on
 * data/wallet.db and never on a copy of anybody's data.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const Database = require('better-sqlite3');

const ROOT = path.join(__dirname, '..', '..');
const BOOT = path.join(__dirname, 'boot.js');
const CATALOGUE = path.join(ROOT, 'qa', 'docs', 'test-cases.md');

// The same discipline as qa/e2e/case-link.js: an id this register does not list
// is a typo, and a typo makes a case look traced when it is not.
const CATALOGUE_IDS = new Set(fs.readFileSync(CATALOGUE, 'utf8').match(/\bTC-[A-Z0-9]+-\d{3}\b/g) || []);
function caseId(id) {
  assert.ok(CATALOGUE_IDS.has(id), `${id} is not listed in qa/docs/test-cases.md`);
  return id;
}

// The settings table exactly as it was before the limit: commit 9924aba's
// src/schema.sql. Copied rather than generated, so the test keeps describing
// the old shape even after schema.sql moves on.
const OLD_SCHEMA = `
  CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE settings (
    user_id              INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    monthly_income_cents INTEGER NOT NULL DEFAULT 0 CHECK (monthly_income_cents >= 0)
  );
  CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT,
    UNIQUE (user_id, name)
  );
`;

/** A throwaway database holding one account and one saved income, in the old shape. */
function oldDatabase(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-migration-'));
  const file = path.join(dir, 'old.db');
  const db = new Database(file);
  db.exec(OLD_SCHEMA);
  db.prepare("INSERT INTO users (id, email, password_hash) VALUES (1, 'before@example.test', 'not-a-hash')").run();
  db.prepare('INSERT INTO settings (user_id, monthly_income_cents) VALUES (1, 150000)').run();
  db.prepare('INSERT INTO categories (id, user_id, name, icon) VALUES (7, 1, ?, ?)').run('Old category', 'C');
  db.close();

  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return file;
}

/** One boot of the application's database layer against that file. */
function boot(file, ...args) {
  const result = spawnSync(process.execPath, [BOOT, ...args], {
    cwd: ROOT,
    env: { ...process.env, DB_PATH: file },
    encoding: 'utf8',
  });
  assert.strictEqual(result.status, 0, `boot failed: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

const columnNames = (state) => state.columns.map((c) => c.name);
const limitColumn = (state) => state.columns.find((c) => c.name === 'monthly_limit_cents');

test('TC-DB-001 · an old database gains the limit column and keeps what it had', (t) => {
  caseId('TC-DB-001');
  const file = oldDatabase(t);

  const before = new Database(file);
  assert.ok(
    !before.pragma('table_info(settings)').some((c) => c.name === 'monthly_limit_cents'),
    'the fixture must start without the column, or this test proves nothing'
  );
  before.close();

  const after = boot(file);

  assert.ok(columnNames(after).includes('monthly_limit_cents'), 'the column was not added');
  assert.strictEqual(limitColumn(after).notnull, 0, 'the column must be nullable');
  assert.deepStrictEqual(after.rows, [
    { user_id: 1, monthly_income_cents: 150000, monthly_limit_cents: null },
  ], 'the stored income must survive and the limit must read as "not set"');
  // Through the application layer, not only the table: null, never zero (A3).
  assert.deepStrictEqual(after.settings, { monthly_income_cents: 150000, monthly_limit_cents: null });
});

test('TC-DB-002 · booting the upgraded database again is safe', (t) => {
  caseId('TC-DB-002');
  const file = oldDatabase(t);

  boot(file);
  const withLimit = boot(file, '--set-limit=12000');
  assert.strictEqual(withLimit.settings.monthly_limit_cents, 12000);

  const third = boot(file);
  assert.strictEqual(
    columnNames(third).filter((n) => n === 'monthly_limit_cents').length,
    1,
    'the guard must not add the column a second time'
  );
  assert.deepStrictEqual(third.settings, { monthly_income_cents: 150000, monthly_limit_cents: 12000 },
    'a limit stored between boots must survive the next boot');

  const cleared = boot(file, '--set-limit=null');
  assert.strictEqual(cleared.settings.monthly_limit_cents, null, 'clearing must restore "not set", not zero');
});

test('TC-DB-003 · an upgraded database and a fresh one have the same settings table', (t) => {
  caseId('TC-DB-003');
  const upgraded = boot(oldDatabase(t));

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-migration-fresh-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const fresh = boot(path.join(dir, 'fresh.db'));

  assert.deepStrictEqual(upgraded.columns, fresh.columns,
    'the upgrade path and the create path must end at the same table');
});

test('TC-DB-004 · category limits upgrade preserves old rows as NULL (REQ-CL-13)', (t) => {
  caseId('TC-DB-004');
  const file = oldDatabase(t);
  const before = new Database(file);
  assert.ok(!before.pragma('table_info(categories)').some(c => c.name === 'monthly_limit_cents'));
  before.close();
  const after = boot(file);
  assert.ok(after.categoryColumns.some(c => c.name === 'monthly_limit_cents' && c.notnull === 0));
  assert.deepStrictEqual(after.categories, [
    { id: 7, user_id: 1, name: 'Old category', icon: 'C', monthly_limit_cents: null },
  ]);
});

test('TC-DB-005 · repeated category upgrade preserves a stored zero limit (REQ-CL-13)', (t) => {
  caseId('TC-DB-005');
  const file = oldDatabase(t);
  boot(file);
  const db = new Database(file);
  db.prepare('UPDATE categories SET monthly_limit_cents = 0 WHERE id = 7').run();
  db.close();
  const again = boot(file);
  assert.strictEqual(again.categoryColumns.filter(c => c.name === 'monthly_limit_cents').length, 1);
  assert.strictEqual(again.categories[0].monthly_limit_cents, 0);
});

test('TC-DB-006 · fresh and upgraded categories enforce the same CHECK (REQ-CL-13)', (t) => {
  caseId('TC-DB-006');
  const file = oldDatabase(t);
  const upgraded = boot(file);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-category-fresh-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const fresh = boot(path.join(dir, 'fresh.db'));
  assert.deepStrictEqual(upgraded.categoryColumns, fresh.categoryColumns);
  const freshDb = new Database(path.join(dir, 'fresh.db'));
  try {
    freshDb.prepare("INSERT INTO users (id, email, password_hash) VALUES (1, 'migration@example.test', 'synthetic')").run();
    freshDb.prepare("INSERT INTO categories (id, user_id, name, icon) VALUES (7, 1, 'Fresh category', 'C')").run();
    assert.throws(() => freshDb.prepare('UPDATE categories SET monthly_limit_cents = -1 WHERE id = 7').run(), /CHECK constraint failed/);
  } finally { freshDb.close(); }
  const db = new Database(file);
  try {
    assert.throws(() => db.prepare('UPDATE categories SET monthly_limit_cents = -1 WHERE id = 7').run(), /CHECK constraint failed/);
    for (const value of [null, 0, 100000000]) {
      db.prepare('UPDATE categories SET monthly_limit_cents = ? WHERE id = 7').run(value);
      assert.strictEqual(db.prepare('SELECT monthly_limit_cents FROM categories WHERE id = 7').get().monthly_limit_cents, value);
    }
  } finally { db.close(); }
});

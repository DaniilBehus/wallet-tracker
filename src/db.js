'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'wallet.db');

fs.mkdirSync(path.dirname(path.resolve(DB_PATH)), { recursive: true });

const db = new Database(DB_PATH);

// How long to wait for a lock instead of failing immediately. Set FIRST,
// because it governs the statements after it.
db.pragma('busy_timeout = 5000');

/**
 * Retry a boot-time step while SQLite says the database is locked.
 *
 * `busy_timeout` is not enough on its own, which is the whole of BUG-011.
 * It makes *statements* wait, but the boot sequence includes operations SQLite
 * refuses outright rather than queueing — switching the journal mode needs a
 * lock no other connection holds, and even READING `journal_mode` was observed
 * failing with SQLITE_BUSY while another process was mid-boot on the same file.
 * A pragma that cannot be read is not a pragma that can be waited for.
 *
 * So the boot retries, and it retries the whole step rather than the statement,
 * because "another process is setting this up right now" is answered by looking
 * again in a moment — not by trying harder at the same instant.
 *
 * Deliberately synchronous: this runs before the server listens, and there is
 * nothing else for the process to be doing.
 */
function whileLocked(label, step) {
  const deadline = Date.now() + 5000;
  for (;;) {
    try {
      return step();
    } catch (err) {
      if (err.code !== 'SQLITE_BUSY' || Date.now() > deadline) {
        throw new Error(`${label} failed: ${err.message}`, { cause: err });
      }
      // A short synchronous pause. Atomics.wait on a throwaway buffer is the
      // only way to sleep without an event loop turn, and a turn here would
      // let the server start listening on a database that is not ready.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
  }
}

// SQLite has foreign keys OFF by default. Without this line every
// ON DELETE CASCADE in schema.sql is decoration.
whileLocked('foreign_keys', () => db.pragma('foreign_keys = ON'));

// Switching journal mode is a no-op when the file is already in WAL — which it
// is on every boot after the first — so ask before setting. That turns the
// usual case into a read and leaves the contended write for the one boot that
// actually has to perform it.
whileLocked('journal_mode', () => {
  if (String(db.pragma('journal_mode', { simple: true })).toLowerCase() !== 'wal') {
    db.pragma('journal_mode = WAL');
  }
});

// Migrations, such as they are: the schema is written entirely with
// IF NOT EXISTS and re-applied on every boot, so starting the server is
// idempotent. This is enough for a single-file personal app. The moment a
// column has to change in place, this grows a schema_version table — and that
// will be a D-### decision, not a quiet rewrite.
whileLocked('schema', () =>
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'))
);

// Categories are user-owned (spec §3), so the starter set is seeded per user at
// registration rather than globally.
//
// These are user-visible text living outside public/app.js's string table —
// the server writes them into the database at registration, so they cannot be
// translated at render time. D-018 records this as one of the four places the
// interface language actually lives.
const DEFAULT_CATEGORIES = [
  { name: 'Groceries', icon: '🛒' },
  { name: 'Transport', icon: '🚌' },
  { name: 'Housing', icon: '🏠' },
  { name: 'Restaurants', icon: '🍽️' },
  { name: 'Health', icon: '💊' },
  { name: 'Clothing', icon: '👕' },
  { name: 'Entertainment', icon: '🎬' },
  { name: 'Phone & internet', icon: '📱' },
  { name: 'Education', icon: '📚' },
  { name: 'Other', icon: '📦' },
];

const insertCategory = db.prepare(
  'INSERT INTO categories (user_id, name, icon) VALUES (?, ?, ?)'
);

const seedCategories = db.transaction((userId) => {
  for (const category of DEFAULT_CATEGORIES) {
    insertCategory.run(userId, category.name, category.icon);
  }
});

module.exports = { db, seedCategories, DEFAULT_CATEGORIES, DB_PATH };

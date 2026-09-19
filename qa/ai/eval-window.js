'use strict';

/*
 * Evaluator-only rolling rate window (D-043): at most 5 provider calls in any
 * rolling 10 minutes, for `qa/ai/evaluate.js --live`.
 *
 * It is not an application limit. src/ai/limits.js and the Wallet application
 * never load this file, and nothing here enables a provider anywhere.
 *
 *   * The window is stored in the evaluation database (table
 *     eval_provider_calls), so a restart or another process sees the same calls.
 *   * reserveCall() checks and inserts in one BEGIN IMMEDIATE transaction, with
 *     the clock read inside it, so two processes cannot both take the last slot.
 *   * The evaluator reserves immediately before dispatch; a failed, timed-out or
 *     unusable request keeps its slot. Nothing is ever released or deleted, so
 *     the table is also the history of every attempted call.
 *   * A reservation dated in the future (a clock set back) still counts.
 *
 * The limit is a constant on purpose: no environment variable can raise it.
 */

const fs = require('fs');

const EVAL_WINDOW = Object.freeze({ calls: 5, ms: 10 * 60 * 1000 });

const TABLE_SQL = `
CREATE TABLE IF NOT EXISTS eval_provider_calls (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  reserved_at_ms INTEGER NOT NULL,
  provider       TEXT    NOT NULL,
  model          TEXT    NOT NULL,
  kind           TEXT    NOT NULL CHECK (kind IN ('real', 'local_fake')),
  row_id         TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS eval_provider_calls_reserved_at ON eval_provider_calls (reserved_at_ms);
`;

class EvalWindowFull extends Error {
  constructor({ used, availableAtMs }) {
    super(`evaluation rate limit: ${EVAL_WINDOW.calls} provider calls per rolling ${EVAL_WINDOW.ms / 60000} minutes reached`);
    this.name = 'EvalWindowFull';
    this.code = 'EVAL_WINDOW_FULL';
    this.used = used;
    this.availableAtMs = availableAtMs;
  }
}

function ensureWindowTable(db) {
  db.exec(TABLE_SQL);
}

/** Reservation times still inside the window at `nowMs`, oldest first. */
function timesInWindow(db, nowMs) {
  return db.prepare('SELECT reserved_at_ms AS t FROM eval_provider_calls WHERE reserved_at_ms > ? ORDER BY reserved_at_ms, id')
    .all(nowMs - EVAL_WINDOW.ms)
    .map((r) => r.t);
}

/**
 * @param times   reservation times inside the window, oldest first
 * @param needed  how many free slots the caller needs (1 for a single call)
 * @returns {{used: number, limit: number, free: number, availableAtMs: number|null}}
 *   availableAtMs: when `needed` slots are free; null if they are free now,
 *   Infinity if `needed` exceeds the limit and can never fit one window.
 */
function stateOf(times, needed = 1) {
  const used = times.length;
  const free = Math.max(0, EVAL_WINDOW.calls - used);
  let availableAtMs = null;
  if (needed > EVAL_WINDOW.calls) availableAtMs = Infinity;
  else if (free < needed) {
    // `mustExpire` oldest reservations have to leave the window; the last of
    // them to leave decides.
    const mustExpire = used - (EVAL_WINDOW.calls - needed);
    availableAtMs = times[mustExpire - 1] + EVAL_WINDOW.ms;
  }
  return { used, limit: EVAL_WINDOW.calls, free, availableAtMs };
}

function windowState(db, nowMs = Date.now(), needed = 1) {
  return stateOf(timesInWindow(db, nowMs), needed);
}

/**
 * Read-only look at an evaluation database file: no file, directory, table or
 * journal is created, and a database from before the window counts as empty.
 */
function readWindowState(dbPath, nowMs = Date.now(), needed = 1) {
  if (!fs.existsSync(dbPath)) return stateOf([], needed);
  const Database = require('better-sqlite3');
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'eval_provider_calls'").get();
    return exists ? windowState(db, nowMs, needed) : stateOf([], needed);
  } finally {
    db.close();
  }
}

/**
 * Atomic check-and-reserve of one slot. Throws EvalWindowFull, writing nothing,
 * when the window is full.
 * @param {object} call
 * @param {string} call.provider   openai | gemini
 * @param {string} call.model
 * @param {'real'|'local_fake'} call.kind
 * @param {string} call.rowId      corpus row id
 * @param {() => number} [call.clock]  milliseconds; read inside the transaction
 * @returns {{id: number, reservedAtMs: number, used: number}}
 */
function reserveCall(db, { provider, model, kind, rowId, clock = () => Date.now() }) {
  const tx = db.transaction(() => {
    const nowMs = clock();
    const state = windowState(db, nowMs);
    if (state.free < 1) throw new EvalWindowFull({ used: state.used, availableAtMs: state.availableAtMs });
    const info = db.prepare('INSERT INTO eval_provider_calls (reserved_at_ms, provider, model, kind, row_id) VALUES (?, ?, ?, ?, ?)')
      .run(nowMs, String(provider), String(model), kind, String(rowId));
    return { id: Number(info.lastInsertRowid), reservedAtMs: nowMs, used: state.used + 1 };
  });
  return tx.immediate();
}

/** "now", or "at 2026-09-17T12:10:00.000Z (in 60 s)". */
function availabilityText(availableAtMs, nowMs = Date.now()) {
  if (availableAtMs === null || availableAtMs <= nowMs) return 'now';
  return `at ${new Date(availableAtMs).toISOString()} (in ${Math.ceil((availableAtMs - nowMs) / 1000)} s)`;
}

module.exports = { EVAL_WINDOW, EvalWindowFull, ensureWindowTable, windowState, readWindowState, reserveCall, availabilityText };

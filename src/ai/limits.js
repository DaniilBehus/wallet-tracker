'use strict';

// Cost limits for AI draft requests (spec/ai-expense-entry.md §7, D-034).
//
// Two mechanisms, deliberately different:
//
//   * Quotas — daily global, daily per user, per minute per user — are rows in
//     SQLite, reserved in one BEGIN IMMEDIATE transaction BEFORE the provider is
//     called. They survive restarts and are shared by every process on the same
//     database. A reservation is kept even when the call then fails, so failing
//     requests cannot be repeated for free. The write lock is released before
//     the network call starts.
//
//   * Concurrency — at most N requests in flight, and one per user — is an
//     in-memory counter of THIS process. It is not multi-process protection and
//     is not described as such anywhere.
//
// Only period, scope, user id and count are stored. No text, ever.

const { ApiError } = require('../errors');

const pad2 = (n) => String(n).padStart(2, '0');

function localParts(date) {
  const day = `${String(date.getFullYear()).padStart(4, '0')}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  const minute = `${day}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  return { day, minute };
}

function secondsToNextMinute(date) {
  return Math.max(1, 60 - date.getSeconds());
}

function secondsToMidnight(date) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return Math.max(1, Math.ceil((next.getTime() - date.getTime()) / 1000));
}

const limited = (retryAfter) => {
  const err = new ApiError(429, 'AI_RATE_LIMITED', 'AI suggestions are temporarily limited; enter the expense manually');
  err.retryAfter = retryAfter;
  return err;
};

/**
 * @param {object} deps
 * @param {import('better-sqlite3').Database} deps.db
 * @param {{globalDaily, userDaily, userMinute, maxConcurrent, perUserConcurrent}} deps.limits
 * @param {{now: () => Date}} deps.clock
 */
function createLimits({ db, limits, clock }) {
  const inFlight = { global: 0, users: new Map() };

  const read = db.prepare('SELECT count FROM ai_quota WHERE period = ? AND scope = ? AND user_id = ?');
  const bump = db.prepare(
    `INSERT INTO ai_quota (period, scope, user_id, count) VALUES (?, ?, ?, 1)
     ON CONFLICT (period, scope, user_id) DO UPDATE SET count = count + 1`
  );
  const prune = db.prepare('DELETE FROM ai_quota WHERE substr(period, 1, 10) < ?');

  const countOf = (period, scope, userId) => {
    const row = read.get(period, scope, userId);
    return row ? row.count : 0;
  };

  /** Throws 429 when a slot is not free. Returns a release function. */
  function acquireSlot(userId) {
    const mine = inFlight.users.get(userId) || 0;
    if (inFlight.global >= limits.maxConcurrent || mine >= limits.perUserConcurrent) {
      throw limited(1);
    }
    inFlight.global += 1;
    inFlight.users.set(userId, mine + 1);
    let released = false;
    return function release() {
      if (released) return;
      released = true;
      inFlight.global -= 1;
      const left = (inFlight.users.get(userId) || 1) - 1;
      if (left <= 0) inFlight.users.delete(userId);
      else inFlight.users.set(userId, left);
    };
  }

  const reserveTx = db.transaction((userId) => {
    const now = clock.now();
    const { day, minute } = localParts(now);

    if (countOf(day, 'global-day', 0) >= limits.globalDaily) throw limited(secondsToMidnight(now));
    if (countOf(day, 'user-day', userId) >= limits.userDaily) throw limited(secondsToMidnight(now));
    if (countOf(minute, 'user-minute', userId) >= limits.userMinute) throw limited(secondsToNextMinute(now));

    bump.run(day, 'global-day', 0);
    bump.run(day, 'user-day', userId);
    bump.run(minute, 'user-minute', userId);

    // Short retention: yesterday's rows are all that the day boundary needs.
    const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2);
    prune.run(localParts(cutoff).day);
  });

  /** Atomic check-and-increment of all three quotas. Throws 429 when exhausted. */
  function reserve(userId) {
    reserveTx.immediate(userId);
  }

  const snapshot = () => ({ global: inFlight.global, users: inFlight.users.size });

  return { acquireSlot, reserve, snapshot };
}

module.exports = { createLimits, localParts };

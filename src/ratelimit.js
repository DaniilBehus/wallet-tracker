'use strict';

// Failed-login throttling (spec §5, D-016).
//
// A Map, a counter and a timestamp — not a dependency. Spec §2 fixes the
// dependency count at four, and this is not worth the fifth.
//
// The reason it exists is measured rather than assumed: BUG-004 recorded that
// twenty connections sending wrong passwords take GET /api/health from 1.2 ms
// to 1819 ms, because bcrypt costs ~50 ms of CPU that Node spends *instead of*
// serving anything else. So `check()` runs BEFORE the password is hashed. A
// limiter that rejects after doing the expensive work would leave the problem
// exactly where it found it.

const { ApiError } = require('./validate');

const MAX_FAILURES = Number(process.env.LOGIN_MAX_FAILURES || 5);
const WINDOW_MS = Number(process.env.LOGIN_WINDOW_MS || 15 * 60 * 1000);

// Above this many tracked keys, a write sweeps out expired ones. Without it a
// long-running process would accumulate a bucket per e-mail ever mistyped.
const SWEEP_THRESHOLD = 10000;

/** key -> { failures, expiresAt } */
const buckets = new Map();

const tooManyRequests = (message) => new ApiError(429, 'RATE_LIMITED', message);

function bucketFor(key, now) {
  const bucket = buckets.get(key);
  // An expired bucket is the same as no bucket: the window has passed and the
  // count starts again. This is what makes the block lift by itself.
  if (!bucket || bucket.expiresAt <= now) return null;
  return bucket;
}

function sweep(now) {
  for (const [key, bucket] of buckets) {
    if (bucket.expiresAt <= now) buckets.delete(key);
  }
}

/**
 * Keys an attempt is counted against: the account being tried, and where it is
 * being tried from. Whichever trips first wins — see D-016 for why one alone is
 * not enough.
 */
function keysFor(email, ip) {
  const keys = [];
  if (typeof email === 'string' && email.trim()) {
    keys.push(`email:${email.trim().toLowerCase()}`);
  }
  if (ip) keys.push(`ip:${ip}`);
  return keys;
}

/**
 * Throws 429 if any key is over the limit. Call before doing any expensive
 * work. Returns the number of attempts still allowed, for the caller to expose
 * if it wants to.
 */
function check(email, ip) {
  const now = Date.now();
  let remaining = MAX_FAILURES;

  for (const key of keysFor(email, ip)) {
    const bucket = bucketFor(key, now);
    if (!bucket) continue;

    if (bucket.failures >= MAX_FAILURES) {
      const retryAfter = Math.max(1, Math.ceil((bucket.expiresAt - now) / 1000));
      const error = tooManyRequests(
        'Too many failed login attempts. Try again later.'
      );
      error.retryAfter = retryAfter;
      throw error;
    }
    remaining = Math.min(remaining, MAX_FAILURES - bucket.failures);
  }

  return remaining;
}

/**
 * Records one failure against every key.
 *
 * The window starts at the first failure and is not extended by later ones:
 * a fixed window that expires on its own schedule cannot be held open forever
 * by an attacker who keeps knocking, and it makes "when does this lift" an
 * answerable question.
 */
function recordFailure(email, ip) {
  const now = Date.now();
  if (buckets.size > SWEEP_THRESHOLD) sweep(now);

  for (const key of keysFor(email, ip)) {
    const bucket = bucketFor(key, now);
    if (bucket) bucket.failures += 1;
    else buckets.set(key, { failures: 1, expiresAt: now + WINDOW_MS });
  }
}

/** A successful login clears the record — the person is who they said they were. */
function clear(email, ip) {
  for (const key of keysFor(email, ip)) buckets.delete(key);
}

/** Test seam: forget everything. Not reachable through the API. */
function reset() {
  buckets.clear();
}

module.exports = {
  check,
  recordFailure,
  clear,
  reset,
  MAX_FAILURES,
  WINDOW_MS,
};

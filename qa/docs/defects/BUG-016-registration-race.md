**English** · [Slovenčina](../../../locales/sk/qa/docs/defects/BUG-016-registration-race.md)

# BUG-016 · Concurrent registrations of the same email return 500

[← Back to README](../../../README.md#qa-evidence) · [Defect register](../../../log/BUGS.md) · [Next: report index →](README.md)

## Overview and impact

Two simultaneous registrations of the same email could return an internal server error rather than a controlled duplicate-account response.

## Metadata

| Field | Recorded value |
|---|---|
| Type | Defect |
| Status | **CLOSED** — current canonical register |
| Severity | High |
| Priority | Not recorded separately |
| Component | `src/auth.js` register, `src/schema.sql` users.email UNIQUE |
| Found / affected build | S21; exact build only where recorded below |
| Environment / frequency | Not separately recorded; do not infer a frequency from later green runs |

## Preconditions and test data

S21, five pairs of concurrent registration requests

## Reproduction

1. send two simultaneous POST /api/auth/register requests with the same new synthetic email and valid password; repeat with fresh emails.

This step restates the dated historical recipe; it is not a newly executed test.

## Expected and requirement

one 201, one controlled duplicate-email conflict, not INTERNAL.

## Actual observation

all 5 pairs return 201 + 500; server sees SQLITE_CONSTRAINT_UNIQUE.

## Evidence

- [Recorded source: `src/auth.js`](../../../src/auth.js)
- [Recorded source: `src/schema.sql`](../../../src/schema.sql)
- [Recorded source: `qa/race/run.js`](../../../qa/race/run.js)
- [Complete original register, preserved as a dated archive](../../../log/BUGS-archive-before-2026-10-26.md) — find heading `BUG-016`.

## Resolution and verification

Current disposition: **CLOSED**. Register fix field: e291ea9. This status is limited to the documented finding and its own regression evidence.

scenario E in `qa/race/run.js` — two registrations of one fresh
address, sent together to two server processes sharing one database, 120 pairs
per run. Invariant: one 201 and one 409, in either order; any 5xx or a second
201 is a violation. Control: with the mapping removed the scenario reports
`201 · 500` and a violation on every pair (3 of 3 in the control run), with
`SQLITE_CONSTRAINT_UNIQUE` in the server log; with the fix, 0 violations.

## Technical investigation and dated history

<details>
<summary>Open the original detailed report/observation</summary>

### BUG-016 · Concurrent registrations of the same email return 500 · High · CLOSED

| | |
|---|---|
| Found in | S21, five pairs of concurrent registration requests |
| Component | `src/auth.js` register, `src/schema.sql` users.email UNIQUE |

**Steps to reproduce:** send two simultaneous POST /api/auth/register requests
with the same new synthetic email and valid password; repeat with fresh emails.
**Expected:** one 201, one controlled duplicate-email conflict, not INTERNAL.
**Actual:** all 5 pairs return 201 + 500; server sees SQLITE_CONSTRAINT_UNIQUE.
**Root cause:** both SELECT checks finish before async bcrypt.hash; the losing
INSERT violates UNIQUE, which is not mapped to the application's conflict error.
**Fix:** applied in commit `e291ea9`. The insert and the starter categories are now one
`db.transaction`, so an account can no longer exist without the rows it needs,
and `SQLITE_CONSTRAINT_UNIQUE` from that write is translated into the same
`conflict` the pre-read raises — a 409, not a 500. The pre-read stays as a fast
path that avoids hashing an obvious duplicate; it is no longer mistaken for a
guard, because it cannot be one: `bcrypt.hash` yields, and both requests pass it
before either writes.
**Regression:** scenario E in `qa/race/run.js` — two registrations of one fresh
address, sent together to two server processes sharing one database, 120 pairs
per run. Invariant: one 201 and one 409, in either order; any 5xx or a second
201 is a violation. Control: with the mapping removed the scenario reports
`201 · 500` and a violation on every pair (3 of 3 in the control run), with
`SQLITE_CONSTRAINT_UNIQUE` in the server log; with the fix, 0 violations.
**→ Rule R14.**

</details>

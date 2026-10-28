**English** · [Slovenčina](../../../locales/sk/qa/docs/defects/BUG-018-loan-cent-precision.md)

# BUG-018 · A large loan loses an integer cent in remaining money

[← Back to README](../../../README.md#qa-evidence) · [Defect register](../../../log/BUGS.md) · [Next: report index →](README.md)

## Overview and impact

An oversized loan multiplication crossed the safe-integer boundary and made remaining money wrong by one cent.

## Metadata

| Field | Recorded value |
|---|---|
| Type | Defect |
| Status | **CLOSED** — current canonical register |
| Severity | Critical |
| Priority | Not recorded separately |
| Component | `src/validate.js` totalCount; `src/routes/schedules.js` shape |
| Found / affected build | S21; exact build only where recorded below |
| Environment / frequency | Not separately recorded; do not infer a frequency from later green runs |

## Preconditions and test data

S21, large-count schedule probe and exact BigInt comparison

## Reproduction

1. create a valid loan with amount_cents=99999999 and total_count=99999999; compare remaining_cents with exact integer multiplication.

This step restates the dated historical recipe; it is not a newly executed test.

## Expected and requirement

9999999800000001 cents, or a controlled rejection of unsupported
totals; spec money invariant forbids silently wrong cents.

## Actual observation

201 with 9999999800000000 cents, an unsafe JavaScript integer.
total_count=1e30 is also accepted. These are extreme synthetic inputs.

## Evidence

- [Recorded source: `src/validate.js`](../../../src/validate.js)
- [Recorded source: `src/routes/schedules.js`](../../../src/routes/schedules.js)
- [Recorded source: `public/app.js`](../../../public/app.js)
- [Recorded source: `qa/api/wallet.postman_collection.json`](../../../qa/api/wallet.postman_collection.json)
- [Complete original register, preserved as a dated archive](../../../log/BUGS-archive-before-2026-10-26.md) — find heading `BUG-018`.

## Resolution and verification

Current disposition: **CLOSED**. Register fix field: bd516ac. This status is limited to the documented finding and its own regression evidence.

TC-API-109 (1200 instalments at the amount ceiling: 201 and
`remaining_cents` exactly 99999999 × 1200, asserted to be a safe integer),
TC-API-110 (1201 → 400), TC-API-111 (the reported loan, 99999999 × 99999999 →
400), TC-API-112 (1e30 → 400) and TC-API-113 (the same ceiling on `PATCH`) in
`qa/api/wallet.postman_collection.json`; TC-E2E-075 in `qa/e2e/schedules.spec.js`
for the form, which also asserts that nothing is sent. Controls: with the count
ceiling removed, 6 of 650 Newman assertions fail — and the two extreme loans are
still refused, by the product check; with both checks removed, 12 fail and the
reported loan is accepted again. With the client ceiling removed, TC-E2E-075
fails on both viewports. With everything in place: 650 of 650 and 16 of 16.

## Technical investigation and dated history

<details>
<summary>Open the original detailed report/observation</summary>

### BUG-018 · A large loan loses an integer cent in remaining money · Critical · CLOSED

| | |
|---|---|
| Found in | S21, large-count schedule probe and exact BigInt comparison |
| Component | `src/validate.js` totalCount; `src/routes/schedules.js` shape |

**Steps to reproduce:** create a valid loan with amount_cents=99999999 and
total_count=99999999; compare remaining_cents with exact integer multiplication.
**Expected:** 9999999800000001 cents, or a controlled rejection of unsupported
totals; spec money invariant forbids silently wrong cents.
**Actual:** 201 with 9999999800000000 cents, an unsafe JavaScript integer.
total_count=1e30 is also accepted. These are extreme synthetic inputs.
**Root cause:** Number.isInteger does not imply safe precision; count and the
derived multiplication have no safe-integer/product bound.
**Decision D-046:** `total_count` is capped at 1200 — a hundred years
of monthly instalments — and `amount_cents × total_count` must be a safe
integer; anything else is a 400. Exact arithmetic (BigInt, or cents as strings)
would change the JSON money contract every client and test depends on, for
loans nobody takes; a bound keeps the contract and removes the wrong number.
**Fix:** applied in commit `bd516ac`. `src/validate.js` gained `MAX_TOTAL_COUNT = 1200`
in `totalCount`, and `loanTotalCents(amount, count)`, which refuses a pair whose
product is not a safe integer. `src/routes/schedules.js` calls it on create and,
inside the edit transaction, on the pair the edit would leave behind — raising
the amount of a long loan moves the product as surely as raising the count.
`public/app.js` refuses more than 1200 instalments in the form and says so.
With the two ceilings in place the largest possible product is 1.2e11, so the
product check cannot fire today: it is the invariant the money contract rests
on, kept true if either ceiling is ever raised, and no test can reach it while
both stand.
**Summary aggregates:** measured, not assumed. SQLite sums in 64-bit integers,
but `better-sqlite3` returns a JavaScript number by default: asked for a sum of
2^53 + 1 it answers 9007199254740992 — rounded, with no error (the same query
with `safeIntegers` returns the exact BigInt). `GET /summary` sums one account's
expenses for one month, each at most 100 000 000 cents, so the total leaves the
exact range only past 90 071 993 maximum-value expenses in a single month for a
single account. Nothing in the schema or the API caps how many rows a month may
hold, so that is unreachable in practice rather than impossible by construction.
The month balance and the limit arithmetic add numbers of the same size, so they
are exact whenever the total is. Left as it stands — it needs the same decision
about representation that this bug's fix deliberately avoided.
**Regression:** TC-API-109 (1200 instalments at the amount ceiling: 201 and
`remaining_cents` exactly 99999999 × 1200, asserted to be a safe integer),
TC-API-110 (1201 → 400), TC-API-111 (the reported loan, 99999999 × 99999999 →
400), TC-API-112 (1e30 → 400) and TC-API-113 (the same ceiling on `PATCH`) in
`qa/api/wallet.postman_collection.json`; TC-E2E-075 in `qa/e2e/schedules.spec.js`
for the form, which also asserts that nothing is sent. Controls: with the count
ceiling removed, 6 of 650 Newman assertions fail — and the two extreme loans are
still refused, by the product check; with both checks removed, 12 fail and the
reported loan is accepted again. With the client ceiling removed, TC-E2E-075
fails on both viewports. With everything in place: 650 of 650 and 16 of 16.
**→ Rule R14.**

</details>

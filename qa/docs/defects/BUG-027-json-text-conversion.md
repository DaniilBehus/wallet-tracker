**English** · [Slovenčina](../../../locales/sk/qa/docs/defects/BUG-027-json-text-conversion.md)

# BUG-027 · Non-convertible note/icon JSON returned internal errors

[← Back to README](../../../README.md#qa-evidence) · [Defect register](../../../log/BUGS.md) · [Next: report index →](README.md)

## Overview and impact

JSON values with non-convertible note or icon fields returned internal errors instead of validation failures.

## Metadata

| Field | Recorded value |
|---|---|
| Type | Defect |
| Status | **CLOSED** — current canonical register |
| Severity | High |
| Priority | Not recorded separately |
| Component | `src/validate.js`; transaction/category routes |
| Found / affected build | 2026-10-09 HTTP control; exact build only where recorded below |
| Environment / frequency | Not separately recorded; do not infer a frequency from later green runs |

## Preconditions and test data

2026-10-09, real disposable HTTP contract control

## Reproduction

1. send `{ "toString": null }` or an array containing it as expense note (unkeyed POST, keyed POST, PATCH) or category icon.

This step restates the dated historical recipe; it is not a newly executed test.

## Expected and requirement

400 `VALIDATION_FAILED`, no write or key reservation.

## Actual observation

all eight tested requests returned 500. Numeric,
boolean, ordinary object/array, null and string values still converted normally.

## Evidence

- [Recorded source: `src/validate.js`](../../../src/validate.js)
- [Recorded source: `qa/docs/test-report-api-validation.md`](../../../qa/docs/test-report-api-validation.md)
- [Complete original register, preserved as a dated archive](../../../log/BUGS-archive-before-2026-10-26.md) — find heading `BUG-027`.

## Resolution and verification

Current register status: **CLOSED**. The dated reconciliation records: [Non-convertible text/icon HTTP failures and repaired 400 regressions](../../../qa/docs/test-report-api-validation.md); contract CI passed.

The original investigation below may use an earlier `IN PROGRESS` or “local/uncommitted” label. It is preserved as historical evidence, not a competing current status. This documentation migration ran no new scenario.

## Technical investigation and dated history

<details>
<summary>Open the original detailed report/observation</summary>

### BUG-027 · Non-convertible note/icon JSON returned internal errors · High · IN PROGRESS

| Found in | 2026-10-09, real disposable HTTP contract control |
| Component | `src/validate.js`; transaction/category routes |

**Steps to reproduce:** send `{ "toString": null }` or an array containing it
as expense note (unkeyed POST, keyed POST, PATCH) or category icon.
**Expected:** 400 `VALIDATION_FAILED`, no write or key reservation.
**Actual before repair:** all eight tested requests returned 500. Numeric,
boolean, ordinary object/array, null and string values still converted normally.
**Root cause:** direct `String(value)` could throw for a JSON value whose
conversion method was shadowed by client input.
**Fix:** local and uncommitted; one nullable text validator catches only failed
conversion, used in both keyed canonicalization and save without changing the
accepted payload/hash shape.
**Regression:** eight invalid responses are now 400; accepted type partitions,
keyed replay and null/omitted canonical equivalence pass. Full contract 14/14,
335 validated responses. [Details](../../../qa/docs/test-report-api-validation.md).
**→ No rule — one-off.**

</details>

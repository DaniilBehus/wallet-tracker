**English** · [Slovenčina](../../../locales/sk/qa/docs/defects/BUG-026-api-pagination-validation.md)

# BUG-026 · Unsafe pagination and IDs bypassed validation

[← Back to README](../../../README.md#qa-evidence) · [Defect register](../../../log/BUGS.md) · [Next: report index →](README.md)

## Overview and impact

Unsafe pagination values and IDs bypassed HTTP validation and reached internal-error paths.

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

1. authenticated GET `/api/transactions?offset=1e30`, then try offset and owned IDs above `Number.MAX_SAFE_INTEGER`.

This step restates the dated historical recipe; it is not a newly executed test.

## Expected and requirement

unsafe integers and conversion failures return 400
`VALIDATION_FAILED`; safe but absent owned IDs remain 404.

## Actual observation

`offset=1e30` returned 500; `9007199254740992`
returned 200 as offset and 404 as owned ID. A category object with a non-callable
`toString` returned 500. No invalid write changed the ledger.

## Evidence

- [Recorded source: `src/validate.js`](../../../src/validate.js)
- [Recorded source: `qa/docs/test-report-api-validation.md`](../../../qa/docs/test-report-api-validation.md)
- [Complete original register, preserved as a dated archive](../../../log/BUGS-archive-before-2026-10-26.md) — find heading `BUG-026`.

## Resolution and verification

Current register status: **CLOSED**. The dated reconciliation records: [Unsafe-number HTTP failures and repaired 400 regressions](../../../qa/docs/test-report-api-validation.md); contract CI passed.

The original investigation below may use an earlier `IN PROGRESS` or “local/uncommitted” label. It is preserved as historical evidence, not a competing current status. This documentation migration ran no new scenario.

## Technical investigation and dated history

<details>
<summary>Open the original detailed report/observation</summary>

### BUG-026 · Unsafe pagination and IDs bypassed validation · High · IN PROGRESS

| Found in | 2026-10-09, real disposable HTTP contract control |
| Component | `src/validate.js`; transaction/category routes |

**Steps to reproduce:** authenticated GET `/api/transactions?offset=1e30`,
then try offset and owned IDs above `Number.MAX_SAFE_INTEGER`.
**Expected:** unsafe integers and conversion failures return 400
`VALIDATION_FAILED`; safe but absent owned IDs remain 404.
**Actual before repair:** `offset=1e30` returned 500; `9007199254740992`
returned 200 as offset and 404 as owned ID. A category object with a non-callable
`toString` returned 500. No invalid write changed the ledger.
**Root cause:** `Number.isInteger` accepts unsafe magnitudes, and `Number(raw)`
can throw on user-controlled JSON objects.
**Fix:** local and uncommitted; shared parsers require safe integers and map a
throwing conversion to a field-specific 400, retaining the limit ceiling.
**Regression:** focused before 0/2, after 2/2; full contract 14/14 and 335
validated responses; safe offset maximum and compatible keyed category casts
still pass. [Details](../../../qa/docs/test-report-api-validation.md).
**→ No rule — one-off.**

</details>

**English** · [Slovenčina](../../../locales/sk/qa/docs/defects/BUG-030-static-exception-validation.md)

# BUG-030 · Stale or redundant static-gate exceptions passed C9

[← Back to README](../../../README.md#qa-evidence) · [Defect register](../../../log/BUGS.md) · [Next: report index →](README.md)

## Overview and impact

The C9 static gate accepted stale, duplicate or redundant exception entries rather than rejecting them.

## Metadata

| Field | Recorded value |
|---|---|
| Type | Defect |
| Status | **CLOSED** — current canonical register |
| Severity | Medium |
| Priority | Not recorded separately |
| Component | `scripts/coverage-gates.js`, `scripts/check-exceptions.json` |
| Found / affected build | 2026-10-10 negative controls; exact build only where recorded below |
| Environment / frequency | Not separately recorded; do not infer a frequency from later green runs |

## Preconditions and test data

2026-10-10, in-memory exception negative controls

## Reproduction

1. add a valid-looking C6 route, C7 testid or C8 status exception that is absent from the current inventory; add an already-addressed or duplicate entry; try an invalid entry shape.

This step restates the dated historical recipe; it is not a newly executed test.

## Expected and requirement

C9 fails with a specific stale, redundant, duplicate or invalid-entry diagnostic; unavailable required inventories fail without false stale claims.

## Actual observation

C9 checked reason length only. The initial control run had 23 passed and 6 failed; malformed data could throw outside the intended gate verdict.

## Evidence

- [Recorded source: `scripts/coverage-gates.js`](../../../scripts/coverage-gates.js)
- [Recorded source: `scripts/check-exceptions.json`](../../../scripts/check-exceptions.json)
- [Recorded source: `qa/docs/test-report-static-gates.md`](../../../qa/docs/test-report-static-gates.md)
- [Complete original register, preserved as a dated archive](../../../log/BUGS-archive-before-2026-10-26.md) — find heading `BUG-030`.

## Resolution and verification

Current register status: **CLOSED**. The dated reconciliation records: [Stale/redundant exception negative controls](../../../qa/docs/test-report-static-gates.md); static-gate CI passed. The remaining `500` exception is explicit and unexercised, not a runtime waiver.

The original investigation below may use an earlier `IN PROGRESS` or “local/uncommitted” label. It is preserved as historical evidence, not a competing current status. This documentation migration ran no new scenario.

## Technical investigation and dated history

<details>
<summary>Open the original detailed report/observation</summary>

### BUG-030 · Stale or redundant static-gate exceptions passed C9 · Medium · IN PROGRESS

| Found in | 2026-10-10, in-memory exception negative controls |
| Component | `scripts/coverage-gates.js`, `scripts/check-exceptions.json` |

**Steps to reproduce:** add a valid-looking C6 route, C7 testid or C8 status exception that is absent from the current inventory; add an already-addressed or duplicate entry; try an invalid entry shape.
**Expected:** C9 fails with a specific stale, redundant, duplicate or invalid-entry diagnostic; unavailable required inventories fail without false stale claims.
**Actual before repair:** C9 checked reason length only. The initial control run had 23 passed and 6 failed; malformed data could throw outside the intended gate verdict.
**Fix:** local and uncommitted; C9 uses the same current inventories as C6–C8, validates shape/reason/identity, and keeps malformed entries from crashing the other gates.
**Regression:** final independent local `test:gates` 31/31 and `check` 8/8; original input hashes were unchanged by in-memory controls. The one current `500` exception remains an explicit unexercised static gap, not a runtime waiver.
**→ No rule — one-off.** [Details](../../../qa/docs/test-report-static-gates.md).

</details>

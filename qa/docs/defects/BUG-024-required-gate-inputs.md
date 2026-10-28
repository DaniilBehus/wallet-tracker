**English** · [Slovenčina](../../../locales/sk/qa/docs/defects/BUG-024-required-gate-inputs.md)

# BUG-024 · Required validator inputs could disappear with a green result

[← Back to README](../../../README.md#qa-evidence) · [Defect register](../../../log/BUGS.md) · [Next: report index →](README.md)

## Overview and impact

Required validator inputs could disappear while the static gate still returned success.

## Metadata

| Field | Recorded value |
|---|---|
| Type | Defect |
| Status | **CLOSED** — current canonical register |
| Severity | High |
| Priority | Not recorded separately |
| Component | `scripts/check.js`, `scripts/coverage-gates.js` |
| Found / affected build | 2026-10-09 control; exact build only where recorded below |
| Environment / frequency | Not separately recorded; do not infer a frequency from later green runs |

## Preconditions and test data

2026-10-09, in-memory filesystem negative control

## Reproduction

1. make only `spec/architecture.md` unavailable to the actual check functions without touching the real file.

This step restates the dated historical recipe; it is not a newly executed test.

## Expected and requirement

missing required architecture/hash/source/UI/E2E/collection/page
object inputs make the self-check fail.

## Actual observation

C1 SKIP, then `OK — 7 pass, 1 skip, 0 fail`, exit 0.
Empty source/UI inventories also passed by zero iteration.

## Evidence

- [Recorded source: `scripts/check.js`](../../../scripts/check.js)
- [Recorded source: `scripts/coverage-gates.js`](../../../scripts/coverage-gates.js)
- [Complete original register, preserved as a dated archive](../../../log/BUGS-archive-before-2026-10-26.md) — find heading `BUG-024`.

## Resolution and verification

Current register status: **CLOSED**. The dated reconciliation records: [Missing-input and empty-inventory controls](../../../qa/docs/test-report-validator-controls.md); required static gates passed in current API CI. Static declarations are not behavioral coverage.

The original investigation below may use an earlier `IN PROGRESS` or “local/uncommitted” label. It is preserved as historical evidence, not a competing current status. This documentation migration ran no new scenario.

## Technical investigation and dated history

<details>
<summary>Open the original detailed report/observation</summary>

### BUG-024 · Required validator inputs could disappear with a green result · High · IN PROGRESS

| Found in | 2026-10-09, in-memory filesystem negative control |
| Component | `scripts/check.js`, `scripts/coverage-gates.js` |

**Steps to reproduce:** make only `spec/architecture.md` unavailable to the
actual check functions without touching the real file.
**Expected:** missing required architecture/hash/source/UI/E2E/collection/page
object inputs make the self-check fail.
**Actual before repair:** C1 SKIP, then `OK — 7 pass, 1 skip, 0 fail`, exit 0.
Empty source/UI inventories also passed by zero iteration.
**Root cause:** scaffolding-era SKIP branches and vacuous collection loops.
**Fix:** local and uncommitted; all established required inputs and nonempty
inventories fail when absent. No production file was removed for the probes.
**Regression:** focused missing/empty controls pass; normal check is 8 pass,
0 skip, 0 fail; OpenAPI source inventory is 21/21.
**→ No rule — one-off.**

</details>

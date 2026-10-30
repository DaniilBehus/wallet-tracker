**English** · [Slovenčina](../../../locales/sk/qa/docs/defects/BUG-031-static-coverage-wording.md)

# BUG-031 · Static inventory gate wording overstated runtime coverage

[← Back to README](../../../README.md#qa-evidence) · [Defect register](../../../log/BUGS.md) · [Next: report index →](README.md)

## Overview and impact

Static gate messages suggested executed route/status/selector coverage that a source-text inventory cannot prove.

## Metadata

| Field | Recorded value |
|---|---|
| Type | Defect |
| Status | **CLOSED** — current canonical register |
| Severity | Medium |
| Priority | Not recorded separately |
| Component | `scripts/check.js`, `scripts/coverage-gates.js`, QA documentation |
| Found / affected build | 2026-10-10 evidence review; exact build only where recorded below |
| Environment / frequency | Not separately recorded; do not infer a frequency from later green runs |

## Preconditions and test data

2026-10-10, comparison of gate wording with real-response matrix

## Reproduction

A complete numbered reproduction recipe was not recorded in the historical observation. See the dated evidence below; do not treat a reconstructed recipe as an executed test.

## Expected and requirement

C6–C8 must be described as static declarations; executed behavior requires separate real-response and browser evidence.

## Actual observation

C6–C8 matched source/test text and reported labels that could be mistaken for executed requests or functioning selectors; C8 matched status literals globally, not per operation.

## Evidence

- [Recorded source: `scripts/check.js`](../../../scripts/check.js)
- [Recorded source: `scripts/coverage-gates.js`](../../../scripts/coverage-gates.js)
- [Recorded source: `qa/docs/test-report-static-gates.md`](../../../qa/docs/test-report-static-gates.md)
- [Complete original register, preserved as a dated archive](../../../log/BUGS-archive-before-2026-10-26.md) — find heading `BUG-031`.

## Resolution and verification

Current register status: **CLOSED**. The dated reconciliation records: [Static wording and real-response boundary](../../../qa/docs/test-report-static-gates.md); current gate/contract CI passed. No per-branch execution is inferred from C6–C8.

The original investigation below may use an earlier `IN PROGRESS` or “local/uncommitted” label. It is preserved as historical evidence, not a competing current status. This documentation migration ran no new scenario.

## Technical investigation and dated history

<details>
<summary>Open the original detailed report/observation</summary>

### BUG-031 · Static inventory gate wording overstated runtime coverage · Medium · IN PROGRESS

| Found in | 2026-10-10, comparison of gate wording with real-response matrix |
| Component | `scripts/check.js`, `scripts/coverage-gates.js`, QA documentation |

**Problem:** C6–C8 scan source and test text. Their former names and messages could be read as proof that a request executed, a selector worked on a rendered page, or each operation/status branch was provoked. C8 in particular matches status assertions globally.
**Expected:** static declaration checks and real execution evidence are named separately.
**Fix:** local and uncommitted; gate names, diagnostics and current documentation now say STATIC. The observed contract operation/status matrix retains its NOT EXERCISED cells; no behavioral coverage is inferred from these gates.
**Verification:** independent local `check` 8/8, plus contract tests 15/15 with 340 validated real HTTP responses. This does not turn all matrix cells into exercised cases.
**→ No rule — one-off.** [Details](../../../qa/docs/test-report-static-gates.md).

</details>

**English** · [Slovenčina](../../../locales/sk/qa/docs/defects/BUG-029-evaluator-report-collision.md)

# BUG-029 · Concurrent evaluator reports can overwrite each other

[← Back to README](../../../README.md#qa-evidence) · [Defect register](../../../log/BUGS.md) · [Next: report index →](README.md)

## Overview and impact

Evaluators sharing a fixed start timestamp could write the same report basename and overwrite one another’s evidence.

## Metadata

| Field | Recorded value |
|---|---|
| Type | Defect |
| Status | **CLOSED** — current canonical register |
| Severity | High |
| Priority | Not recorded separately |
| Component | `qa/ai/evaluate.js` report writer |
| Found / affected build | 2026-10-10 fixed-clock control; exact build only where recorded below |
| Environment / frequency | Not separately recorded; do not infer a frequency from later green runs |

## Preconditions and test data

2026-10-10, fixed-clock copied-evaluator control

## Reproduction

1. run two evaluators concurrently with the same start timestamp and inspect each printed JSON/Markdown report path.

This step restates the dated historical recipe; it is not a newly executed test.

## Expected and requirement

each run retains its own complete report pair; a convenience latest view identifies one completed report.

## Actual observation

both runs printed the same path, allowing the later write to replace the earlier evidence.

## Evidence

- [Recorded source: `qa/ai/evaluate.js`](../../../qa/ai/evaluate.js)
- [Recorded source: `qa/docs/test-report-evaluator-concurrency.md`](../../../qa/docs/test-report-evaluator-concurrency.md)
- [Complete original register, preserved as a dated archive](../../../log/BUGS-archive-before-2026-10-26.md) — find heading `BUG-029`.

## Resolution and verification

Current register status: **CLOSED**. The dated reconciliation records: [Fixed-clock distinct-report and partial-write controls](../../../qa/docs/test-report-evaluator-concurrency.md); offline AI CI passed. Two-file publication is still not atomic.

The original investigation below may use an earlier `IN PROGRESS` or “local/uncommitted” label. It is preserved as historical evidence, not a competing current status. This documentation migration ran no new scenario.

## Technical investigation and dated history

<details>
<summary>Open the original detailed report/observation</summary>

### BUG-029 · Concurrent evaluator reports can overwrite each other · High · IN PROGRESS

| Found in | 2026-10-10, fixed-clock copied-evaluator control |
| Component | `qa/ai/evaluate.js` report writer |

**Steps to reproduce:** run two evaluators concurrently with the same start timestamp and inspect each printed JSON/Markdown report path.
**Expected:** each run retains its own complete report pair; a convenience latest view identifies one completed report.
**Actual before repair:** both runs printed the same path, allowing the later write to replace the earlier evidence.
**Root cause:** the basename contained only mode and millisecond start time, and writes replaced existing files.
**Fix:** local and uncommitted; add a random run identity, publish completed temporary files to exclusive final names, and make the latest view name the completed report it displays. A failed pair write cleans only its own files and does not announce success.
**Regression:** fixed-clock runs retained distinct JSON/Markdown pairs; injected second-file failure left no partial pair or success line. Two-file publication is not an atomic transaction, and latest means last completed writer, not latest start.
**→ No rule — one-off.** [Details](../../../qa/docs/test-report-evaluator-concurrency.md).

</details>

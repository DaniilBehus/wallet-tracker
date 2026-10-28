**English** · [Slovenčina](../../../locales/sk/qa/docs/defects/BUG-025-race-cleanup-ownership.md)

# BUG-025 · Race cleanup could remove another run's database

[← Back to README](../../../README.md#qa-evidence) · [Defect register](../../../log/BUGS.md) · [Next: report index →](README.md)

## Overview and impact

The race runner’s cleanup sweep could remove a database belonging to another run.

## Metadata

| Field | Recorded value |
|---|---|
| Type | Defect |
| Status | **CLOSED** — current canonical register |
| Severity | Medium |
| Priority | Not recorded separately |
| Component | `qa/race/run.js` |
| Found / affected build | 2026-10-09 control; exact build only where recorded below |
| Environment / frequency | Not separately recorded; do not infer a frequency from later green runs |

## Preconditions and test data

2026-10-09, in-memory other-run sentinel control

## Reproduction

1. expose another run's `race-*` file to the runner's old cleanup seam. Do not use a real user or application database for this probe.

This step restates the dated historical recipe; it is not a newly executed test.

## Expected and requirement

only the current run's owned temporary directory may be removed.

## Actual observation

the prefix sweep attempted to remove the sentinel.

## Evidence

- [Recorded source: `qa/race/run.js`](../../../qa/race/run.js)
- [Complete original register, preserved as a dated archive](../../../log/BUGS-archive-before-2026-10-26.md) — find heading `BUG-025`.

## Resolution and verification

Current register status: **CLOSED**. The dated reconciliation records: [Other-run sentinel and owned-cleanup controls](../../../qa/docs/test-report-validator-controls.md); current race CI passed. No sweep of another run's database is authorized.

The original investigation below may use an earlier `IN PROGRESS` or “local/uncommitted” label. It is preserved as historical evidence, not a competing current status. This documentation migration ran no new scenario.

## Technical investigation and dated history

<details>
<summary>Open the original detailed report/observation</summary>

### BUG-025 · Race cleanup could remove another run's database · Medium · IN PROGRESS

| Found in | 2026-10-09, in-memory other-run sentinel control |
| Component | `qa/race/run.js` |

**Steps to reproduce:** expose another run's `race-*` file to the runner's old
cleanup seam. Do not use a real user or application database for this probe.
**Expected:** only the current run's owned temporary directory may be removed.
**Actual before repair:** the prefix sweep attempted to remove the sentinel.
**Root cause:** cleanup selected every matching name under `data/`, not an owned path.
**Fix:** local and uncommitted; allocate a unique canonical directory, validate
its parent and name, and remove only it after both children stop. If shutdown or
cleanup fails, retain the directory and return failure.
**Regression:** in-memory sentinel untouched; real disposable fixture sentinel
untouched; one real 120-pair-per-scenario run passed and removed its own directory.
**→ No rule — one-off.**

</details>

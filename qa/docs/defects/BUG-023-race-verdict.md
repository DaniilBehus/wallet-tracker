**English** · [Slovenčina](../../../locales/sk/qa/docs/defects/BUG-023-race-verdict.md)

# BUG-023 · Registration-race violation was ignored by final verdict

[← Back to README](../../../README.md#qa-evidence) · [Defect register](../../../log/BUGS.md) · [Next: report index →](README.md)

## Overview and impact

A registration-race invariant violation was reported but did not make the final runner verdict fail.

## Metadata

| Field | Recorded value |
|---|---|
| Type | Defect |
| Status | **CLOSED** — current canonical register |
| Severity | High |
| Priority | Not recorded separately |
| Component | `qa/race/run.js` |
| Found / affected build | 2026-10-09 control; exact build only where recorded below |
| Environment / frequency | Not separately recorded; do not infer a frequency from later green runs |

## Preconditions and test data

2026-10-09, in-memory race-runner negative control

## Reproduction

1. make only scenario E receive 201 and 500; run the real runner orchestration with synthetic in-memory clients.

This step restates the dated historical recipe; it is not a newly executed test.

## Expected and requirement

E's recorded violation makes the command exit nonzero.

## Actual observation

E recorded one violation, but the final sum omitted E,
printed success and exited 0.

## Evidence

- [Recorded source: `qa/race/run.js`](../../../qa/race/run.js)
- [Complete original register, preserved as a dated archive](../../../log/BUGS-archive-before-2026-10-26.md) — find heading `BUG-023`.

## Resolution and verification

Current register status: **CLOSED**. The dated reconciliation records: [E-only negative verdict and enforcing-scenario controls](../../../qa/docs/test-report-validator-controls.md); race task passed in current API CI. D remains measurement-only.

The original investigation below may use an earlier `IN PROGRESS` or “local/uncommitted” label. It is preserved as historical evidence, not a competing current status. This documentation migration ran no new scenario.

## Technical investigation and dated history

<details>
<summary>Open the original detailed report/observation</summary>

### BUG-023 · Registration-race violation was ignored by final verdict · High · IN PROGRESS

| Found in | 2026-10-09, in-memory race-runner negative control |
| Component | `qa/race/run.js` |

**Steps to reproduce:** make only scenario E receive 201 and 500; run the real
runner orchestration with synthetic in-memory clients.
**Expected:** E's recorded violation makes the command exit nonzero.
**Actual before repair:** E recorded one violation, but the final sum omitted E,
printed success and exited 0.
**Root cause:** a second handwritten sum did not match the scenario report.
**Fix:** local and uncommitted; one registry now drives report and enforcing
verdict, validates pair evidence, and explicitly marks D measurement-only.
**Regression:** E-only failure exits 1; each other enforcing failure exits 1;
all-good enforcing cases with D duplicates exit 0; 23/23 validator controls pass.
**→ No rule — one-off.**

</details>

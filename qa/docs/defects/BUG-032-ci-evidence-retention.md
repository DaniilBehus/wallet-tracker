**English** · [Slovenčina](../../../locales/sk/qa/docs/defects/BUG-032-ci-evidence-retention.md)

# BUG-032 · CI and local verification diverged; reports were not retained

[← Back to README](../../../README.md#qa-evidence) · [Defect register](../../../log/BUGS.md) · [Next: report index →](README.md)

## Overview and impact

The local test command and CI did not share one verification inventory; API and Python reports were generated but not retained as CI artifacts.

## Metadata

| Field | Recorded value |
|---|---|
| Type | Defect |
| Status | **CLOSED** — current canonical register |
| Severity | Medium |
| Priority | Not recorded separately |
| Component | CI workflow, verification commands and QA evidence retention |
| Found / affected build | 2026-10-10 plan controls; exact build only where recorded below |
| Environment / frequency | Not separately recorded; do not infer a frequency from later green runs |

## Preconditions and test data

2026-10-10, source comparison of workflow, package scripts and report producers

## Reproduction

A complete numbered reproduction recipe was not recorded in the historical observation. See the dated evidence below; do not treat a reconstructed recipe as an executed test.

## Expected and requirement

Local and CI should use the same required task plan, fail closed on missing prerequisites and retain allowlisted API/Python evidence.

## Actual observation

The baseline CI omitted the race command while `npm test` excluded several CI suites. Newman and Python result files were generated locally without CI artifact upload steps.

## Evidence

- [Recorded source: `qa/docs/test-report-ci-verification.md`](../../../qa/docs/test-report-ci-verification.md)
- [Complete original register, preserved as a dated archive](../../../log/BUGS-archive-before-2026-10-26.md) — find heading `BUG-032`.

## Resolution and verification

Current register status: **CLOSED**. The dated reconciliation records: [Shared-plan controls](../../../qa/docs/test-report-ci-verification.md) plus the [actual post-merge run and artifacts](https://github.com/DaniilBehus/wallet-tracker/actions/runs/39248991256): six uploaded artifacts; the API archive contains HTML, JUnit, race summary and run summary, and the Python archive contains JUnit and run summary. Timeout and privacy-screening limits in the dated report remain.

The original investigation below may use an earlier `IN PROGRESS` or “local/uncommitted” label. It is preserved as historical evidence, not a competing current status. This documentation migration ran no new scenario.

## Technical investigation and dated history

<details>
<summary>Open the original detailed report/observation</summary>

### BUG-032 · CI and local verification diverged; API/Python reports were not retained · Medium · IN PROGRESS

| Found in | 2026-10-10, source comparison of workflow, package scripts and report producers |
| Component | CI workflow, verification commands and QA evidence retention |

**Problem:** the published baseline CI omitted the race layer, while `npm test` excluded several CI suites. An earlier local edit added race, but no shared plan kept local and CI groups aligned. Newman HTML/JUnit and Python JUnit were generated without CI upload steps.
**Expected:** an explicit CI-equivalent plan with fail-closed prerequisites and retained allowlisted reports on success or failure.
**Fix:** local and uncommitted; shared six-group/18-task inventory, fail-fast runner with `NOT_RUN` statuses and ignored compact identity summary, plus v4 upload steps for staged API/Python/race evidence. Existing browser failure traces and seven-day retention remain.
**Verification:** nine focused controls pass. The isolated API group passed 10/10 tasks; Python passed 27/27 items. The default local plan failed at missing `gitleaks` and correctly left 17 tasks `NOT_RUN`. Full local/remote CI and actual upload behavior are **not verified**.
**Review addendum:** the earlier nine-control suite could falsely accept E2E's wrong dependency by matching the next job and falsely reject an equivalent CRLF workflow. The first same-helper regressions observed 9 pass / 2 fail; the bounded job check now passes 12/12, including wrong-edge, CRLF and unsupported-form cases. The actual workflow was already correct; real groups were not rerun. Tracked deletions can fail identity before a summary, children have no wrapper timeout, provenance is invocation-only, local CI flags can differ, and privacy screening remains heuristic. This local repair does not establish remote artifact uploads or close this IN PROGRESS finding.
**Line-ending fixture follow-up:** a full read-only virtual CRLF view exposed two LF-only mutation fixtures before helper invocation (10 pass / 2 fail). They now normalize before mutation and exercise both LF and CRLF forms without changing the workflow. Final selected controls pass 12/12 on actual LF and 12/12 on virtual CRLF; wrong-dependency and ambiguous-form negatives remain enforced. No real group or remote CI was rerun, so this finding stays IN PROGRESS.
**→ No rule — one-off.** [Details](../../../qa/docs/test-report-ci-verification.md).

</details>

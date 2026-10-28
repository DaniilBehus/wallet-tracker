**English** · [Slovenčina](../../../locales/sk/qa/docs/defects/BUG-021-schedule-edit-ui.md)

# BUG-021 · Schedules cannot be edited through the interface

[← Back to README](../../../README.md#qa-evidence) · [Defect register](../../../log/BUGS.md) · [Next: report index →](README.md)

## Overview and impact

The application had no usable schedule-edit path in the interface, despite the required editing scenario.

## Metadata

| Field | Recorded value |
|---|---|
| Type | Defect |
| Status | **CLOSED** — current canonical register |
| Severity | High |
| Priority | Not recorded separately |
| Component | `public/app.js` loadSchedules / submitSchedule; `public/index.html` |
| Found / affected build | S21; exact build only where recorded below |
| Environment / frequency | Not separately recorded; do not infer a frequency from later green runs |

## Preconditions and test data

S21, spec-to-UI review and live Schedules inspection

## Reproduction

1. create a schedule, open Schedules, try to change its name, amount or due day using the UI.

This step restates the dated historical recipe; it is not a newly executed test.

## Expected and requirement

Add or edit through a form, as required by spec §6.4.

## Actual observation

list rows are non-interactive; the form only creates. In the probe,
2 schedule rows contain 0 buttons/links/inputs/role=button elements.

## Evidence

- [Recorded source: `public/app.js`](../../../public/app.js)
- [Recorded source: `public/index.html`](../../../public/index.html)
- [Recorded source: `qa/docs/test-report-schedule-editing.md`](../../../qa/docs/test-report-schedule-editing.md)
- [Complete original register, preserved as a dated archive](../../../log/BUGS-archive-before-2026-10-26.md) — find heading `BUG-021`.

## Resolution and verification

Current register status: **CLOSED**. The dated reconciliation records: [Schedule-edit failed-before and local regression](../../../qa/docs/test-report-schedule-editing.md), published with Playwright CI, plus the [product owner's 2026-10-19 current-build schedule-edit PASS and test-build acceptance](../../../qa/docs/uat-current-build.md#owner-record--reported-2026-10-19). This closes the specific missing-Edit defect; the agent did not perform UAT or obtain a general risk waiver.

The original investigation below may use an earlier `IN PROGRESS` or “local/uncommitted” label. It is preserved as historical evidence, not a competing current status. This documentation migration ran no new scenario.

## Technical investigation and dated history

<details>
<summary>Open the original detailed report/observation</summary>

### BUG-021 · Schedules cannot be edited through the interface · High · IN PROGRESS

| | |
|---|---|
| Found in | S21, spec-to-UI review and live Schedules inspection |
| Component | `public/app.js` loadSchedules / submitSchedule; `public/index.html` |

The steps, expected/actual result and "Fix: not applied" below preserve the
original S21 pre-repair observation; the dated update follows.

**Steps to reproduce:** create a schedule, open Schedules, try to change its
name, amount or due day using the UI.
**Expected:** Add or edit through a form, as required by spec §6.4.
**Actual:** list rows are non-interactive; the form only creates. In the probe,
2 schedule rows contain 0 buttons/links/inputs/role=button elements.
**Root cause:** PATCH exists on the API but there is no UI edit-state or update
handler wired to schedule rows. The endpoint alone does not fulfil §6.4.
**Fix:** not applied. Implement the missing UI or obtain an explicit scope
decision; do not rewrite the spec just to make the current code appear complete.
**Regression:** source and browser confirmed; add an actual schedule-edit UI test.
**→ Rule R14.**

**Local addendum, 2026-10-17:** the original observation and older §6.4
reference above remain historical. A controlled browser check first failed on
the missing Edit action. A local UI repair now provides an owned-row native
modal and uses the existing PATCH endpoint. Its first broader run exposed a
new missing-HTML-`id` implementation error; this was diagnosed from the
retained page-error trace and corrected. The final [local F09 report](../../../qa/docs/test-report-schedule-editing.md)
records persisted-field/lifecycle and keyboard controls plus a full managed
browser run. Scoped independent agent review accepted F09 locally on
2026-10-17. Status is **IN PROGRESS**, not CLOSED: combined-tree verification,
exact-SHA remote CI, publication and owner UAT remain. No further known
schedule-edit defect was established by that review.

</details>

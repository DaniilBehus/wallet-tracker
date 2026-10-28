**English** · [Slovenčina](../../../locales/sk/qa/docs/defects/BUG-022-modal-focus-trap.md)

# BUG-022 · Expense overlay does not contain keyboard focus

[← Back to README](../../../README.md#qa-evidence) · [Defect register](../../../log/BUGS.md) · [Next: report index →](README.md)

## Overview and impact

Keyboard focus could escape the expense editor overlay, leaving the visible modal without containment.

## Metadata

| Field | Recorded value |
|---|---|
| Type | Defect |
| Status | **CLOSED** — current canonical register |
| Severity | Medium |
| Priority | Not recorded separately |
| Component | `public/index.html` #tx-edit-sheet; `public/app.js` editor handlers |
| Found / affected build | S21; exact build only where recorded below |
| Environment / frequency | Not separately recorded; do not infer a frequency from later green runs |

## Preconditions and test data

S21, keyboard and semantic inspection in Chromium

## Reproduction

1. open an expense editor; press Escape; then focus Cancel and press Tab.

This step restates the dated historical recipe; it is not a newly executed test.

## Expected and requirement

an accessible modal editor keeps focus within its controls,
supports a clear dismiss action and restores focus after closing.

## Actual observation

Escape leaves it open; Tab goes to nav-add outside the sheet.
The sheet has no dialog role or aria-modal attribute.

## Evidence

- [Recorded source: `public/index.html`](../../../public/index.html)
- [Recorded source: `public/app.js`](../../../public/app.js)
- [Recorded source: `qa/docs/test-report-modal-bind.md`](../../../qa/docs/test-report-modal-bind.md)
- [Complete original register, preserved as a dated archive](../../../log/BUGS-archive-before-2026-10-26.md) — find heading `BUG-022`.

## Resolution and verification

Current register status: **CLOSED**. The dated reconciliation records: [Modal/focus report](../../../qa/docs/test-report-modal-bind.md), published native dialog and browser/accessibility CI. This closes the specific containment defect, not a human accessibility audit or WCAG certification.

The original investigation below may use an earlier `IN PROGRESS` or “local/uncommitted” label. It is preserved as historical evidence, not a competing current status. This documentation migration ran no new scenario.

## Technical investigation and dated history

<details>
<summary>Open the original detailed report/observation</summary>

### BUG-022 · Expense overlay does not contain keyboard focus · Medium · IN PROGRESS

| | |
|---|---|
| Found in | S21, keyboard and semantic inspection in Chromium |
| Component | `public/index.html` #tx-edit-sheet; `public/app.js` editor handlers |

**Steps to reproduce:** open an expense editor; press Escape; then focus Cancel
and press Tab.
**Expected:** an accessible modal editor keeps focus within its controls,
supports a clear dismiss action and restores focus after closing.
**Actual:** Escape leaves it open; Tab goes to nav-add outside the sheet.
The sheet has no dialog role or aria-modal attribute.
**Root cause:** a visual overlay is implemented without modal semantics,
keyboard containment or an Escape handler.
**Fix:** not applied. Add the appropriate dialog pattern and keyboard behaviour.
**Regression:** reproduced in browser; add semantic and keyboard regressions.
**→ Rule R14.**

**2026-10-16 local update (original observation retained):** the editor is now a
named native modal with an explicit first/last Tab wrap, in-dialog error alert,
and checked Escape/Cancel/backdrop restoration. The focused local browser and
axe evidence is in [the modal/bind report](../../../qa/docs/test-report-modal-bind.md).
Independent local agent code/evidence review accepted the modal repair on
2026-10-16. BUG-022 is **IN PROGRESS** pending publication and combined-tree
verification, not because another focus failure is known. This dated update
supersedes the 2026-10-13 OPEN status pointer below; the earlier “Fix: not
applied” line records its original observation, not the current source state.
No human accessibility audit, owner UAT, remote CI or release is inferred.

</details>

**English** · [Slovenčina](../../../locales/sk/qa/docs/defects/BUG-015-uncategorised-expense-edit.md)

# BUG-015 · Editing an uncategorised expense sends category zero

[← Back to README](../../../README.md#qa-evidence) · [Defect register](../../../log/BUGS.md) · [Next: report index →](README.md)

## Overview and impact

Editing only the note of an uncategorised expense sent category zero instead of preserving its null category.

## Metadata

| Field | Recorded value |
|---|---|
| Type | Defect |
| Status | **CLOSED** — current canonical register |
| Severity | Medium |
| Priority | Not recorded separately |
| Component | `public/app.js` — openTransactionEditor / submitTransactionEdit |
| Found / affected build | S21; exact build only where recorded below |
| Environment / frequency | Not separately recorded; do not infer a frequency from later green runs |

## Preconditions and test data

S21, browser edit plus captured PATCH status

## Reproduction

1. create a valid expense with category_id omitted/null; open its Month row; change only Note; save.

This step restates the dated historical recipe; it is not a newly executed test.

## Expected and requirement

only the changed note is patched, keeping category null (D-029).

## Actual observation

PATCH includes category_id 0 and returns 400. Selecting a named
category is a workaround, but incorrectly forces a classification change.

## Evidence

- [Recorded source: `public/app.js`](../../../public/app.js)
- [Recorded source: `qa/e2e/editing.spec.js`](../../../qa/e2e/editing.spec.js)
- [Complete original register, preserved as a dated archive](../../../log/BUGS-archive-before-2026-10-26.md) — find heading `BUG-015`.

## Resolution and verification

Current disposition: **CLOSED**. Register fix field: a399e79. This status is limited to the documented finding and its own regression evidence.

TC-E2E-070 (note-only edit), TC-E2E-071 (unchanged save sends
no request at all) and TC-E2E-072 (an expense created by paying a schedule that
has no category) in `qa/e2e/editing.spec.js`. They read the PATCH off the wire
rather than the screen, because the defect was in what the request carried: a
screen assertion would have passed the moment the toast said "saved". Control:
with the two lines of the fix reverted, all three fail on both viewports (6 of
6); with the fix, 18 of 18 in that file pass.

## Technical investigation and dated history

<details>
<summary>Open the original detailed report/observation</summary>

### BUG-015 · Editing an uncategorised expense sends category zero · Medium · CLOSED

| | |
|---|---|
| Found in | S21, browser edit plus captured PATCH status |
| Component | `public/app.js` — openTransactionEditor / submitTransactionEdit |

**Steps to reproduce:** create a valid expense with category_id omitted/null;
open its Month row; change only Note; save.
**Expected:** only the changed note is patched, keeping category null (D-029).
**Actual:** PATCH includes category_id 0 and returns 400. Selecting a named
category is a workaround, but incorrectly forces a classification change.
**Root cause:** the select contains no empty option; null is rendered as an
empty value and then Number('') becomes 0, differing from original null.
**Fix:** applied in commit `a399e79`. The editor's category list now opens with an
explicit *Uncategorised* option (value `""`), the same one the AI review form
already had, so "no category" is something the list can show and a person can
choose. On save the value is read as `rawCategory === '' ? null : Number(...)`,
so null stays null; the existing "send only what changed" comparison then sees
no change and leaves `category_id` out of the patch entirely. The server needed
nothing: `ownedCategoryId` already accepted null.
**Regression:** TC-E2E-070 (note-only edit), TC-E2E-071 (unchanged save sends
no request at all) and TC-E2E-072 (an expense created by paying a schedule that
has no category) in `qa/e2e/editing.spec.js`. They read the PATCH off the wire
rather than the screen, because the defect was in what the request carried: a
screen assertion would have passed the moment the toast said "saved". Control:
with the two lines of the fix reverted, all three fail on both viewports (6 of
6); with the fix, 18 of 18 in that file pass.
**→ Rule R14.**

</details>

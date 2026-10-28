**English** · [Slovenčina](../../../locales/sk/qa/docs/defects/BUG-014-short-phone-categories.md)

# BUG-014 · Categories collapse to an 18 px strip on a short phone

[← Back to README](../../../README.md#qa-evidence) · [Defect register](../../../log/BUGS.md) · [Next: report index →](README.md)

## Overview and impact

On a short phone, the category chooser collapsed to an 18 px strip beside the keypad.

## Metadata

| Field | Recorded value |
|---|---|
| Type | Defect |
| Status | **CLOSED** — current canonical register |
| Severity | High |
| Priority | Not recorded separately |
| Component | `public/style.css` — Add flex layout and fixed-height controls |
| Found / affected build | S21; exact build only where recorded below |
| Environment / frequency | Not separately recorded; do not infer a frequency from later green runs |

## Preconditions and test data

S21, real Chromium at 320×568

## Reproduction

1. sign in with seeded default categories; resize to 320×568; open Add. Inspect the Categories group's visible height and screenshot.

This step restates the dated historical recipe; it is not a newly executed test.

## Expected and requirement

readable/selectable categories alongside the keypad (spec §6.1).

## Actual observation

clientHeight 18, scrollHeight 670. Labels are clipped to a narrow
strip. Save remains visible; horizontal document width is correctly 320.

## Evidence

- [Recorded source: `public/style.css`](../../../public/style.css)
- [Recorded source: `qa/e2e/ai/add-layout.spec.js`](../../../qa/e2e/ai/add-layout.spec.js)
- [Complete original register, preserved as a dated archive](../../../log/BUGS-archive-before-2026-10-26.md) — find heading `BUG-014`.

## Resolution and verification

Current disposition: **CLOSED**. Register fix field: published in `2face59`. This status is limited to the documented finding and its own regression evidence.

`qa/e2e/ai/add-layout.spec.js`, written and run red first:
clientHeight 18 at 320×568 and 108 at 375×667 against the old CSS (threshold
120). After the fix: 4/4 on mobile and desktop projects — list ≥ 120 px, two
rows fully visible, no horizontal overflow, amount → category → Save completes.
It lives in the AI suite because the defect guards the Add screen the AI entry
point sits on.

## Technical investigation and dated history

<details>
<summary>Open the original detailed report/observation</summary>

### BUG-014 · Categories collapse to an 18 px strip on a short phone · High · CLOSED

| | |
|---|---|
| Found in | S21, real Chromium at 320×568 |
| Component | `public/style.css` — Add flex layout and fixed-height controls |

**Steps to reproduce:** sign in with seeded default categories; resize to
320×568; open Add. Inspect the Categories group's visible height and screenshot.
**Expected:** readable/selectable categories alongside the keypad (spec §6.1).
**Actual:** clientHeight 18, scrollHeight 670. Labels are clipped to a narrow
strip. Save remains visible; horizontal document width is correctly 320.
**Root cause:** amount, note, keypad and navigation consume the available
height; the flexible scrolling category list absorbs the shortage.
**Fix:** S23, uncommitted. `public/style.css`, a `(max-width: 699px) and
(max-height: 760px)` block: the category list keeps a 150 px floor and still
scrolls inside, header and keypad are tighter, and the Add screen scrolls as a
whole when even that does not fit. Save stays one swipe away; nothing is hidden.
**Regression:** `qa/e2e/ai/add-layout.spec.js`, written and run red first:
clientHeight 18 at 320×568 and 108 at 375×667 against the old CSS (threshold
120). After the fix: 4/4 on mobile and desktop projects — list ≥ 120 px, two
rows fully visible, no horizontal overflow, amount → category → Save completes.
It lives in the AI suite because the defect guards the Add screen the AI entry
point sits on.
**→ Rule R14.**

</details>

**English** · [Slovenčina](../../../locales/sk/qa/docs/defects/BUG-013-mobile-edit-overlay.md)

# BUG-013 · The edit panel opened underneath the bottom navigation

[← Back to README](../../../README.md#qa-evidence) · [Defect register](../../../log/BUGS.md) · [Next: report index →](README.md)

## Overview and impact

The mobile expense edit panel opened behind the bottom navigation, blocking access to its controls.

## Metadata

| Field | Recorded value |
|---|---|
| Type | Defect |
| Status | **CLOSED** — current canonical register |
| Severity | Medium |
| Priority | Not recorded separately |
| Component | `public/index.html`, `public/style.css` — the edit sheet |
| Found / affected build | S16; exact build only where recorded below |
| Environment / frequency | Not separately recorded; do not infer a frequency from later green runs |

## Preconditions and test data

S16, by the end-to-end suite on the phone viewport

## Reproduction

1. at 375×812, open an expense for editing and press Save.

This step restates the dated historical recipe; it is not a newly executed test.

## Expected and requirement

the panel is above everything, and its buttons can be pressed.

## Actual observation

the Save button could not be clicked. Playwright resolved the
element, scrolled to it, found it "visible, enabled and stable" — and the click
never landed, because the fixed bottom navigation was on top of it.

## Evidence

- [Recorded source: `public/index.html`](../../../public/index.html)
- [Recorded source: `public/style.css`](../../../public/style.css)
- [Complete original register, preserved as a dated archive](../../../log/BUGS-archive-before-2026-10-26.md) — find heading `BUG-013`.
- [GitHub Issue #14](https://github.com/DaniilBehus/wallet-tracker/issues/14) — external metadata can differ; the local register is the documentation status authority.

## Resolution and verification

Current disposition: **CLOSED**. Register fix field: fixed. This status is limited to the documented finding and its own regression evidence.

**CLOSED.** The edit sheet's stacking and layout were corrected so the mobile bottom navigation no longer intercepts its Save control. Before repair, five of six editing tests failed on `mobile-chromium` while all six passed on desktop; the recorded post-fix six editing tests passed on both viewports. No new browser run was made for this documentation rewrite.

## Technical investigation and dated history

<details>
<summary>Open the original detailed report/observation</summary>

### BUG-013 · The edit panel opened underneath the bottom navigation · Medium · CLOSED

| | |
|---|---|
| Found in | S16, by the end-to-end suite on the phone viewport |
| Component | `public/index.html`, `public/style.css` — the edit sheet |
| Affects | editing an expense on a phone, which is every user of a phone-first app |

**Steps to reproduce:** at 375×812, open an expense for editing and press Save.

**Expected:** the panel is above everything, and its buttons can be pressed.

**Actual:** the Save button could not be clicked. Playwright resolved the
element, scrolled to it, found it "visible, enabled and stable" — and the click
never landed, because the fixed bottom navigation was on top of it.

**Five of six tests failed on `mobile-chromium` and all six passed on
`desktop-chromium`.** That split is the signature: a stacking problem shows up
where the viewport is short enough for the two elements to overlap.

**Root cause:** the panel was written inside `#screen-month`, and `.screen` is a
flex child in its own place in the stacking order. A `z-index` set on a
descendant is confined to its ancestor's stacking context, so `z-index: 40`
competed with the other children of that section — not with the navigation bar,
which is a sibling of the section, painted later, and therefore on top.

The element was genuinely visible. Nothing about it was hidden, disabled or
mispositioned. It was underneath something, which is a different failure and one
that `toBeVisible()` cannot detect — the assertion that would have "passed" here
is exactly the one a person writes by intuition.

**Fix:** the panel moved out of the section to become a sibling of the
navigation, where its `z-index` competes with it directly, and raised to 50.
Closing it on a screen change moved into `showScreen`, because hiding the
section no longer hides the panel.

**Regression:** the six editing tests, on both viewports. They were written
before the fix and failed for the right reason, which is the only way to know a
regression test would have caught the defect it is named after.

**→ Rule R13.**

---

</details>

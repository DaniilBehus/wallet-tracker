**English** · [Slovenčina](../../../locales/sk/qa/docs/defects/BUG-001-save-button-contrast.md)

# BUG-001 · Save button invisible — white text on white background

[← Back to README](../../../README.md#qa-evidence) · [Defect register](../../../log/BUGS.md) · [Next: report index →](README.md)

## Overview and impact

The Save control had white text on a white background: its label existed in the DOM but could not be read on the Add screen.

## Metadata

| Field | Recorded value |
|---|---|
| Type | Defect |
| Status | **CLOSED** — current canonical register |
| Severity | High |
| Priority | Not recorded separately |
| Component | `public/style.css`, `public/index.html` |
| Found / affected build | S03; exact build only where recorded below |
| Environment / frequency | Not separately recorded; do not infer a frequency from later green runs |

## Preconditions and test data

S03, first look at the Add screen in a 375×812 viewport

## Reproduction

1. Sign in and land on the Add screen.
2. Look at the bottom-right key of the keypad.

## Expected and requirement

the primary action of the app's default screen is a blue button
reading `Uložiť`. Spec §6.1 requires a Save button, and it is one of the three
taps in the "two taps and a Save" definition of done (§8, session 4).

## Actual observation

The key looked empty although `textContent` was `"Uložiť"`: its computed background and text colour were both `rgb(255, 255, 255)`.

## Evidence

- [Recorded source: `public/style.css`](../../../public/style.css)
- [Recorded source: `public/index.html`](../../../public/index.html)
- [Complete original register, preserved as a dated archive](../../../log/BUGS-archive-before-2026-10-26.md) — find heading `BUG-001`.
- [GitHub Issue #1](https://github.com/DaniilBehus/wallet-tracker/issues/1) — external metadata can differ; the local register is the documentation status authority.

## Resolution and verification

**CLOSED.** A dedicated `.key--save.key` rule now sets background, border and colour together so equal-specificity source ordering cannot split them. The recorded browser recheck found blue `rgb(61, 90, 254)` behind white `rgb(255, 255, 255)` text and confirmed the other `.btn--primary` controls were unaffected. This is dated evidence, not a new run.

## Technical investigation and dated history

<details>
<summary>Open the original detailed report/observation</summary>

### BUG-001 · Save button invisible — white text on white background · High · CLOSED

| | |
|---|---|
| Found in | S03, first look at the Add screen in a 375×812 viewport |
| Component | `public/style.css`, `public/index.html` |

**Steps to reproduce:**
1. Sign in and land on the Add screen.
2. Look at the bottom-right key of the keypad.

**Expected:** the primary action of the app's default screen is a blue button
reading `Uložiť`. Spec §6.1 requires a Save button, and it is one of the three
taps in the "two taps and a Save" definition of done (§8, session 4).

**Actual:** an empty white key. The text was in the DOM the whole time —
`textContent` was `"Uložiť"` — and it was rendered in white on white:

```
{ bg: "rgb(255, 255, 255)", color: "rgb(255, 255, 255)", text: "Uložiť" }
```

**Root cause:** CSS specificity resolved by source order. The element carried
both `.key` and `.btn--primary`. Both selectors have specificity (0,1,0), so
the later declaration wins — and `.key` is written further down the stylesheet
than `.btn--primary`. `.key` sets `background: var(--surface)` but no `color`,
so the background came from `.key` (white) and the colour from `.btn--primary`
(white). Neither rule was wrong on its own; the pair was split by declaration
order, and half of each won.

**Fix:** the save key stopped borrowing `.btn--primary`. It has its own
`.key--save.key` rule — specificity (0,2,0), above both — which sets background,
border and colour together, so they can no longer be separated by ordering.

**Regression:** reloaded and re-read the computed style; also confirmed the
other two users of `.btn--primary` (`.auth` submit, `.row__pay`) were never
affected, because `.btn` is declared *before* `.btn--primary` rather than after.

```
{ bg: "rgb(61, 90, 254)", color: "rgb(255, 255, 255)", text: "Uložiť" }
```

**→ Rule R2.**

---

</details>

# Accessibility baseline — local evidence, not a WCAG certification

[← Back to README](../../README.md) · [State scans and keyboard tests](../a11y/baseline.spec.js) · [Rendered contrast evidence](../a11y/contrast-evidence.spec.js) · [Next: UI test plan →](test-plan.md)

First recorded 2026-10-07; strict regression follow-up 2026-10-08 on uncommitted changes above `47636553ba622e336aebcabbd00d2ba7e8950d89`. Run `npm run test:a11y` to create a fresh ignored Playwright HTML report at `qa/reports/playwright-a11y/`; each reached state has a full machine-readable axe JSON attachment, including all violations and inconclusive outcomes. The suite uses a disposable local AI demo database and a no-network guard. It does not call a real AI provider, use a real account or measure live service accessibility. The workflow now schedules this command after the normal E2E suite, but this workflow change has **not** been committed, pushed or verified on GitHub Actions.

## Scope and result

The current strict local run passed 12 Playwright tests: six at 320×568 and six at 1280×800. They reached and axe-scanned 11 UI states per viewport, using `wcag2a`, `wcag2aa`, `wcag21a` and `wcag21aa` with no excluded regions or disabled rules. Full unfiltered results are attached **before** each scan asserts `violations == []`. Both negative controls detected a missing image alternative (`image-alt`), so the scanner is not an empty-page pass. The additional tests cover bounded keyboard navigation and rendered contrast evidence; these are checks, not extra axe rule IDs.

Automated axe outcome: **0 confirmed violations, 140 inconclusive color-contrast nodes across 22 scans** (70 per viewport, 28 distinct element targets). `incomplete` is neither a pass nor a confirmed defect: those targets need further contrast assessment. The exact node count can vary with rendered state; compare rule and target evidence rather than treating 140 as a permanent gate threshold. Automated checks cannot establish full WCAG conformance or replace assistive-technology review.

| State (each viewport) | Inconclusive nodes | Representative targets |
|---|---:|---|
| Sign-in / registration | 11 / 11 | `.auth__eyebrow`, `#auth-submit`, labels and inputs |
| Add / validation error | 7 / 6 | `#amount-display`, `.note__label`, bottom navigation |
| Month with category limit | 13 | `#income-value`, `#limit-value`, donut text and navigation |
| Category-limit dialog | 0 | No inconclusive node in this reached state |
| Expense edit sheet | 13 | Underlying Month figures and icon-only delete control |
| Upcoming / Schedules | 3 / 4 | Bottom navigation labels |
| AI demo description / review | 1 / 1 | `#ai-close` icon glyph |

All 140 nodes belong to the axe `color-contrast` rule. The engine could not determine a background behind some text because of a gradient or pseudo-element; two donut text targets were reported as overlapped, and icon-only glyphs were inconclusive because they are non-text characters. These are precise scanner limitations, **not evidence that the current contrast passes**. Full rule details, targets and `failureSummary` remain in the ignored JSON attachments.

## Keyboard regression and the one confirmed fix

The new keyboard regression traverses and activates all four named bottom-navigation buttons with Tab/Enter, checks `:focus-visible` and a real outline, then reaches the Schedules form controls by bounded Tab traversal. It verifies the expense editor's initial focus, Escape dismissal and focus restoration. Existing category-limit focus containment/Escape and native AI dialog focus/Escape checks remain. This is **not** a full keyboard or screen-reader assessment.

Before the product fix, the focused mobile test reached the expense editor but failed: pressing Escape left `tx-edit-amount` visible. The minimal `public/app.js` change now dismisses that sheet on Escape and restores focus to its opener; Cancel and backdrop dismissal use the same restoration path. No save, reload, money or API behavior changed. Focused mobile and desktop regressions then passed 2/2. The edit sheet is still a custom sheet rather than a native modal dialog; this check does not claim complete focus trapping or assistive-technology behavior.

## Bounded rendered contrast inspection

The agent inspected ignored full-page screenshots of auth, Add, Month and AI review at both viewports. The repeatable test also reads actual browser-computed foreground and **opaque, image-free** backing colors, applies the [WCAG relative-luminance and contrast-ratio formula](https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio), and gates four known rendered pairs at 4.5:1. Results were the same at both viewports: auth e-mail text/input 14.95:1, auth password text/input 14.95:1, AI Close glyph/solid header 13.79:1, and AI demo text/solid banner 9.23:1. Screenshots and computed-color JSON are attached to the ignored local Playwright report. These numbers establish **only those pairs**, not the entire page.

No ratio was assigned to text over the auth pseudo-element, Add or Month gradients, donut overlay, or translucent bottom navigation: their actual backing varies or is layered. In the sampled screenshots, the relevant text and focus styling were discernible, but that observation is not a mathematical worst-case bound. These targets remain unresolved for a future focused visual/pixel assessment. If a reliable worst case falls below the standard, a stable opaque backing behind the text is a smaller fix than removing the dark/mint design. Do not suppress axe rules to make the report green.

## AI failure artifacts

The AI CI job now offers an on-failure, seven-day upload limited to `qa/reports/playwright-ai/` and `test-results/ai/`. A disposable local browser failure after the auth screen rendered produced nonempty HTML (518,211 bytes), screenshot (189,702 bytes) and trace (250,046 bytes) in those ignored locations; its temporary failing spec was removed. A normal subsequent AI browser run passed 50/50. A failure before browser startup may have no screenshot or trace, and `if-no-files-found: ignore` handles that case. **Local artifact generation is not proof of an upload on GitHub Actions**; remote verification awaits CI after a separately authorized commit and push.

Read-only `npm audit` reports 26 advisories in the current full dependency tree (9 moderate, 15 high, 2 critical), including one critical advisory with dev dependencies omitted. Neither newly added exact-pinned package (`@axe-core/playwright@4.13.0` nor `axe-core@4.13.0`) has an advisory in that report. Lockfile comparison to the base commit found only these two added dev packages, no removed or version-changed existing package, and unchanged root production dependencies. Broad dependency remediation is separate work; no audit fix or unrelated upgrade was run.

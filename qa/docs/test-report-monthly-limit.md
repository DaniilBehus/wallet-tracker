# Monthly spending limit — test report

**Date:** 2026-09-23 · **Build under test:** the working tree on top of commit
`9924aba` (the feature is not committed yet) · **Verdict: the feature meets the
requirements in [`analysis-monthly-limit.md`](analysis-monthly-limit.md); one
defect was found during testing and fixed; the limits below are known and
stated, not discovered later.**

## 1. Scope of this pass

Requirements REQ-ML-01…10, the eight rules of the decision table, the boundary
list and the negative cases of the analysis document. Twenty cases:
TC-API-091…105 and TC-E2E-065…069, all automated.

Environment: Windows, Node v24.13.1 (CI pins 22), SQLite through
`better-sqlite3`, Playwright 1.62.1 on Chromium at two viewports, Newman against
a server the runner starts with its own throwaway database. No `.env`, no AI
provider, no external service was used.

## 2. Tests first: what failed before the feature existed

Both layers were written against the analysis document and run before any
implementation.

| Layer | Command | Result before implementation |
|---|---|---|
| API | `npm run test:api` | **92 assertions failed** across the new folder 12 and the existing settings/summary contract cases — the response schemas now require `monthly_limit_cents`, `limit_cents`, `limit_status` and `limit_remaining_cents`, and none of them existed |
| Browser | `npx playwright test qa/e2e/month.spec.js -g "Monthly spending limit"` | **10 failed** (5 cases × 2 viewports): every limit test id was missing from the screen |

The same commands after the implementation are in §4.

## 3. Defects found while testing

| # | What | How it was found | Status |
|---|---|---|---|
| 1 | On a phone-width viewport the limit state line sat **inside the flex row** holding the donut and the figures, so it became a third column: the donut covered the limit control and the control could not be tapped | TC-E2E-068 and TC-E2E-069 failed on `mobile-chromium` only, while all five cases passed on the desktop viewport | Fixed — the line moved out of `.overview`; both viewports green. The comment in `public/index.html` records why it may not move back |

Nothing else failed for a product reason. Two API cases were rewritten during
the pass for a *test* reason, recorded here because it changes what the suite
proves: the boundary rules first ran against the first account, whose month
already contains ceiling-sized amounts from other folders, so "one cent below
the month total" was a limit above the 1 000 000 EUR ceiling and was correctly
refused with 400. The decision-table rules now run on the second account, whose
month this folder fills with exact amounts (2500, then 1000).

## 4. Results

| Gate / layer | Command | Result |
|---|---|---|
| Self-check | `npm run check` | **OK — 8 pass, 0 skip, 0 fail** |
| API contract | `npm run test:api` | **171 requests, 621 assertions, 0 failed** |
| Python API scenarios | `npm run test:python` | **16 passed** |
| End-to-end | `npm run test:e2e` | **138 passed** (69 cases × 2 viewports) |
| Concurrency | `npm run test:race` | **0 invariant violations** |
| Whole suite | `npm test` | **exit 0** |
| AI expense entry (untouched by this change) | `npm run test:ai` | **237 tests: 236 passed, 1 skipped, 0 failed** |
| Fixture evaluation (untouched) | `npm run eval:ai` | **FIXTURE PASS, 113/113** |

Traceability, requirement by requirement, is the table in §5 of the analysis
document; every row's result is PASS from this run.

Decision-table coverage, rule by rule: R1 TC-API-095 · R2 TC-API-095 · R3
TC-API-096 · R4 TC-API-096 · R5 TC-API-097 · R6 TC-API-098 · R7 TC-API-099 ·
R8 TC-API-099. Boundaries: `L − 1 / L / L + 1` as TC-API-098/097/096, `L = 0`
as TC-API-099, `L = 1` as TC-API-100, the ceiling and ceiling + 1 as
TC-API-103/102.

## 5. Known limitations

- **One limit, not one per month** (assumption A2). Changing the limit
  re-judges every month on the screen, including past ones. No history is kept.
- **The limit does not block anything** (A1). It is a signal; an expense above
  it is still saved. There is no warning dialog and no notification.
- **Browser coverage is emulated.** Two Chromium viewports, no physical device
  and no other browser engine.
- **No load or concurrency case of its own.** The limit is a read-side
  computation over the existing month query; the k6 and race layers were not
  extended for it.
- **No Python scenario.** The API side is covered by the Newman folder; the
  pytest layer keeps its existing six scenarios.
- **Month boundaries and time zones** are inherited from the existing month
  query, which is tested elsewhere; this pass added no new cases for them.
- **Accessibility** was checked as "text, not colour alone" (REQ-ML-09) and by
  the existing contrast helper on the month screen; no screen-reader pass was
  made.

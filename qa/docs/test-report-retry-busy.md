**English** · [Slovenčina](../../locales/sk/qa/docs/test-report-retry-busy.md)

# Retry and busy-state assurance — focused local report

[← Back to README](../../README.md#qa-evidence) · [Test setup](../../docs/testing.md) · [Next: current QA status →](../../docs/qa-status.md)

**2026-10-13; local, uncommitted checkout at HEAD `b270355` plus changes.** This report covers F22 only. It is not a full combined-tree CI result, a remote artifact-upload result, release acceptance or owner UAT.

## Question and method

TC-E2E-045 holds the response to the first **real** `POST /api/transactions` after the server has processed it. While Save is still awaiting that response, the test checks the disabled button and sends a native mouse click at its centre. It counts POST attempts and independently reads the persisted transactions through the authenticated API; the Month UI must also show one row and €12.50. The `finally` block releases the held response. TC-E2E-047 separately verifies that a deliberate second Save **after** the first finishes creates a legitimate second expense. Neither test replaces the transaction API with a stub or claims that every transport retry is deduplicated.

The negative witness serves an in-memory copy of `public/app.js` to one diagnostic browser, with both `withBusy` button disabling and `saveExpense`'s busy guard bypassed. The product file remains unchanged. The same TC-E2E-045 then fails its `toBeDisabled` assertion; this proves the current test detects that combined regression. It does **not** prove that removing either redundant guard alone would cause duplicate persistence.

## Observed runs

| Bounded run | Observed result |
|---|---|
| Pure F22 controls, before repair | The native Playwright `expected` outcome was rejected as unknown; the mutation helper rejected two `button.disabled = true` matches. These were diagnostic-helper defects, not product failures. |
| Corrected pure F22 controls | 3/3 passed; real-browser controls excluded by name pattern. These are not a five-test suite result. |
| `node --test qa/e2e-controls/retry-busy.test.js` | 5/5 passed. The controlled negative produced one `unexpected` result from the intended Save assertion, not helper/setup failure. The flaky fixture produced one `flaky`: first attempt failed, retry passed, first-failure trace exists, and Playwright exited nonzero under `failOnFlakyTests`. Both fixture servers closed and their owned temporary databases were removed. |
| Managed `qa/e2e/double-submit.spec.js` | 6/6 passed: TC-E2E-045/046/047 in mobile and desktop Chromium. The managed runner closed the server and removed its owned default database. Fresh JSON: `qa/reports/playwright-main/results-72692057-2b74-4f3b-bc91-cb1c58cdf330.json`, `expected: 6`, `unexpected: 0`, `flaky: 0`, SHA-256 `8b62899efb51c01ec3e614042c402c76f8ca56134bcc9327abf32528a40ef6bd`. |
| Existing `scripts/check.js` | 8/8 PASS, 0 skipped; these are static checks, not browser execution. |
| Existing `qa/verify/verify-ci.test.js` | 12/12 PASS after the narrow e2e artifact-path change; no remote workflow run was performed. |

Commands used: `node --test qa/e2e-controls/retry-busy.test.js`, `node qa/e2e-runner/run.js qa/e2e/double-submit.spec.js`, `node scripts/check.js`, and `node --test qa/verify/verify-ci.test.js` with local Node 22.14.0. The controls' last 5/5 run was after the unique-ID check; the 6/6 app run was after the response-holding change. The controlled fixture JSON files from the last run are local ignored artifacts: `output/playwright/F22-z4TKhS/mutation.json` (`unexpected: 1`, SHA-256 `eadbead1e92f63dc7418ee72a35db0f0c628a9ee338bf50271a13d53737ef274`) and `output/playwright/F22-uoVHsN/flaky.json` (`flaky: 1`, SHA-256 `a7f0393b8e862671c92cffbf501693a179bd53436b894a5bc9f61133200100dc`). The first failed attempt's attached `trace.zip` exists under `output/playwright/F22-uoVHsN/results/` (9,811 bytes). These files are evidence for this local run, not links to files distributed with the repository.

## Retry policy and limits

CI retains one diagnostic retry, records native outcome and individual attempt statuses in a **unique per-run JSON filename**, and retains the first failed attempt's trace. A retry-only pass is `flaky`, not clean CI: `failOnFlakyTests` makes the CI Playwright process exit nonzero. The e2e failure artifact glob includes the unique JSON alongside report/traces. A missing new JSON must not be replaced by an older local file; match a report to its current command/start time and source state. The workflow upload is configured locally but **no new remote upload is verified here**.

Native JSON `expected` includes both passing tests and tests deliberately marked as expected to fail; only the separate attempt status says whether an attempt passed. `unexpected`, `flaky` and `skipped` remain distinct. The five-second readiness failure previously observed elsewhere still has no proved cause. BUG-005 remains open, F19 executable mapping is incomplete, and this focused result does not close release, accessibility or owner-acceptance gates.

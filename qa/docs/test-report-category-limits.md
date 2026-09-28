# Category spending limits — local implementation report

[← Back to README](../../README.md#qa-evidence) · [Requirements and trace](analysis-category-limits.md) · [Next: owner UAT →](uat-category-limits.md)

Recorded 2026-09-28. The specification/models were committed **before production
code** at `4d0865107e72d12bd3d146fcb3ea1142b88eb245`; this report describes the
subsequent local implementation. No category-limit push, GitHub CI result or
owner acceptance is claimed.

## What changed

- Nullable category limit with guarded migration; existing rows remain NULL.
- Ownership-scoped PATCH of the limit only; category GET and month rows carry
  limits and server-computed state. Valid expense saving never checks budgets.
- Category-row editor; zero-spend budget rows, white outlined within state and
  solid red reached/over boxes with words. Uncategorised remains noninteractive.
- 28 API case IDs / 92 requests, 3 migration cases, 8 Playwright cases across
  two viewports and one Selenium case; each is in the catalogue.

CL-D1…12 and the frozen requirements, acceptance criteria, decision table and
impact rules are unchanged. Model labels were updated from planned to local
implementation after code and focused checks; owner UAT/publication remain
pending. That status update is recorded in the analysis change notes.

## Test-first evidence and browser findings

Before the category migration was added, TC-DB-004…006 failed on the missing
column while the original three settings cases passed. After implementation
all six passed, including raw negative writes on fresh and upgraded schemas.

The first new browser run exposed incorrect use of the DOM-property helper for
`data-*` / `aria-*` attributes. Using the existing attribute helper fixed the
real DOM and accessibility names. The next run found Tab leaving the native
editor for browser chrome; scoped wrapping fixed it. All 16 focused browser
executions then passed. Errors are inline because page toasts sit below the
native modal. The simulated 400 uses the real nested error contract and checks
the existing translated client message; it is controlled UI coverage, not a
claim about a live server failure.

## Final regression run

All commands run locally against isolated test data, not the owner's database.
These are local results, not a new GitHub CI run. The full Playwright suite was
repeated after correcting a review fixture's stale category cache: an API-created
category now reloads into the browser before capture, and its expense name is
asserted too. This was a fixture correction, not a production caching change.

| Command | Result |
|---|---|
| `npm run check` | PASS: 8 gates |
| `npm run test:db` | PASS: 6 tests |
| `npm run test:api` | PASS: 271 requests / 939 assertions / 0 failures |
| `npm run test:python` | PASS: 27 pytest items |
| `npm run test:e2e -- --workers=2` | PASS: 186 executions (93 scenarios × 2 viewports), repeated after fixture correction |
| `npm run test:ai` | 236 passed / 1 skipped / 0 failed (symlink privilege), 237 total |
| `npm run eval:ai` | PASS: fixture, 116 rows; no model quality measured |
| `npm run test:ai:e2e` | PASS: 50 browser executions |
| `npm run test:race` | PASS: 120 pairs per scenario; no invariant violation |
| `npm run test:selenium` | PASS: 11 pytest items |

Exact fixture evaluation summary:

```text
MODE=FIXTURE MODEL_QUALITY=NOT_MEASURED RESULT=PASS
SCOPE=FULL (selected 116 of 116 rows in split all, scored 116) VERDICT=NOT_APPLICABLE: fixture outputs stand in for the model; no model quality is measured
supported rows 113; row match 100.0% (113/113); complete 100.0% (46/46); amount 100.0% (60/60); date 100.0% (75/75); category 100.0% (79/79); false ready 0; invented amount/date 0; wrong amount/date 0
```

The race runner's unkeyed duplicate POST scenario stored two rows in all 120
pairs. This is its explicitly measured limitation, not a failed budget invariant
or an idempotency promise.

## Negative controls: tests fail when production is wrong

Each control was applied alone to production, ran folder 13 via
`QA_FOLDER='13 · Category spending limits'` and `npm run test:api`, exited 1,
and was reverted byte for byte before the next control and full regression.
The optional folder selector leaves the default full collection unchanged.

| Deliberate defect | Detecting case(s) | Actual failure |
|---|---|---|
| Equality classified exceeded | TC-API-117 / 126 / 128 | 3 failed assertions, 92 requests / 289 assertions |
| Active unpaid schedule counted in zero-spend category | TC-API-132 | 1 failed assertion: 1000 instead of 0 |
| Uncategorised judged against zero | TC-API-134 | 1 failed assertion: limit 0 instead of NULL |
| Owner condition removed from category UPDATE | TC-API-124 | 4 failed assertions + 1 script error; independent owner-value check saw 1 instead of 100000000 |

The last control returned an empty 200 to the other owner because the response
SELECT still enforced ownership. That explains the missing assertion/script
count (288, not 289); it does not mask the separate mutation assertion.

Restored SHA-256 values, verified immediately after each control:

| File | SHA-256 |
|---|---|
| `src/settings.js` | `b348d2d4732618a7bcf3690cc5e601907190b6a261d26bf286a38c0477f0c11d` |
| `src/routes/summary.js` | `04f26f8b41b17391e0d4c17624bfaa8b82fabd46797aab7673bf175d16b54f74` |
| `src/routes/categories.js` | `8c8a8c8850f4af4da190ed605709c3bc8cf5f124ab5e4554159423f47fc3e1b5` |

## Visual review and limits

Untracked review image: `output/playwright/category-limit-states-320.png`,
produced by TC-E2E-091 with real synthetic spending and all three state boxes.
Fit assertions use 320×568; the review capture uses 320×1000 to show every box.
The PNG is deliberately outside tracked documentation. Contrast assertions
measure browser-resolved colours: white on red must reach 4.5:1; within words
also 4.5:1 and its white border 3:1 against the dark surface.

The tracked Month screenshot was regenerated from the actual application because
the category controls changed row spacing. It retains synthetic demonstration
data; the other tracked screenshots are unchanged. All six models validated,
152 documentation links resolved, and two renders were byte-stable for all six
SVGs. Frozen rule sections and the architecture checksum remain unchanged.

The added-text/private-data scan and diff whitespace check passed. Gitleaks is
not installed locally, so this is not a full-history secret-audit claim.
No external service, provider call, owner database or personal account is needed
for these checks.
The first limit of an empty no-budget category requires an expense or API.
There is no forecast or per-month budget history; current limits judge past
queries too. The fallback light stylesheet alone is not the product palette
(RISK-CL-13). [Owner UAT](uat-category-limits.md) is unsigned.

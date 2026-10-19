# F05 pagination consistency — local candidate report

[← Back to README](../../README.md#qa-evidence) · [Technical contract](analysis-pagination-consistency.md) · [QA status](../../docs/qa-status.md)

## Before the repair — 2026-10-16

The real disposable HTTP witness used four same-date own expenses and `limit=2`.
Page one returned the two newest IDs. Inserting a newer expense before an
`offset=2` continuation repeated the already seen boundary ID; deleting a
seen expense before that continuation skipped an unseen surviving ID. This
control passed because it asserted the **old defect**, not the desired result.

The strengthened existing TC-E2E-055 and TC-E2E-057 browser scenarios then
failed **4/4** on the old Month code across phone and desktop. After a second
client inserted a row, the old UI said “Showing 52 of 52” instead of making
the bounded restart; the separate HTTP witness established the duplicate
mechanism. After a second-client deletion, its count reached the end while a
deleted ID remained visible and an unseen surviving ID was absent. These were
product failures, not mock-only
assertions; each test used synthetic API-created rows and the managed browser.

## Local change and bounded guarantee

The original offset API keeps its query behavior, `application/json` media
type and exact `{items,total}` response. An explicit `paging=cursor` selects
`application/vnd.wallet.cursor+json` with `{items,total,next_cursor}`. The
two media types preserve strict, separately validated OpenAPI response shapes.
The continuation uses `spent_on DESC,id DESC`, an account/filter-bound,
strictly validated token and parameterized SQL with a separate `user_id`
predicate. The deleted boundary row is not looked up. A zero-limit or terminal
page has `next_cursor: null`; the Month Show more button then terminates.

For unchanged surviving unseen rows, earlier insertion/deletion alone cannot
make continuation skip or repeat them. When the current total changes, one
Show more action discards the old Month list/cursor and requests one fresh
first page; it never appends the shifted page or shows `51 of 50`. The user
can continue from that page or explicitly revisit Month to refresh. This is
not a database snapshot: edits moving a row's sort position, newly inserted
before-cursor rows until refresh, same-total external mutations and already
cached rows are outside this guarantee. See the [contract](analysis-pagination-consistency.md).

## Observed checks

All HTTP/browser execution used installed Node 22.14.0, guarded loopback,
synthetic accounts, AI off/demo seams and disposable owned databases. No
`.env`, real provider, external target or user data was read by these runs.

| Check | Local result |
|---|---|
| Pre-repair `--test-name-pattern=PAGING-CONTROL` | 1/1 old-offset drift witness PASS (asserted the defect). |
| Pre-repair managed pagination `--grep 'one row past\|count stays honest'` | 0/4 expected product failures, phone and desktop. |
| Post-repair `--test-name-pattern=PAGING-CONTROL` | 2/2 PASS: legacy drift comparison and cursor mutation/validation control. |
| `node scripts/check-openapi.js` | PASS, 21/21 source operations and 300 local refs. An intermediate draft `oneOf` envelope failed the existing typed-response checker; separate strict media schemas fixed that contract-design issue before runtime checks. |
| `node --test qa/contract/contract.test.js` | 17/17 PASS; 388 validated real loopback HTTP responses across 21 source operations. Cursor control covers same-date ties, full termination, insert before boundary, deletion of seen/boundary/unseen rows, empty/zero pages, invalid/noncanonical/overlong/unsafe/date tokens, mixed paging, changed filters/account, other-account list isolation and unchanged DB rows after refusals. |
| `node qa/e2e-runner/run.js qa/e2e/pagination.spec.js` | 8/8 PASS across phone/desktop. Original 50, 51 and 201 boundaries retained; two strengthened cases compare exact surviving ID sets and counter/termination after second-client writes. |
| `node qa/e2e-runner/run.js qa/e2e/editing.spec.js` | 18/18 PASS, preserving the accepted expense editor. |
| Focused managed a11y editor/keyboard checks | 4/4 PASS at 320×568 and 1280×800. A first attempt collided with a concurrently occupied E2E port and never ran the suite; the sequential retry passed. Historical incomplete colour-contrast targets remain unresolved. |
| Source/Login/bind pure controls; CI-plan controls | 73/73 and 13/13 PASS. A first source-control attempt failed 4/73 because editing two catalogue rows invalidated unrelated pinned Postman inventory hashes; those two rows were restored unchanged, the source inventory refreshed and the same 73 controls passed. |
| Static inventory/F13/check/plan | Both source inventory and API inventory `--check` PASS; F13 280 IDs/78 definitions, `scripts/check.js` 8/8, `scripts/verify-ci.js --plan` 22 tasks all `NOT_RUN`. |

Source accounting still has **280 main case IDs**, **138 QA/script files**, six
pinned configs and 20 parameter identities. The two new `PAGING-CONTROL` HTTP
declarations are supplemental support controls, not new catalogue cases.
The earlier 50/51/201 catalogue cases keep their IDs and row text; the actual
055/057 browser source was strengthened. Catalogue wording was left unchanged
because unrelated accepted Postman inventories pin the whole catalogue file.
At the time of this worker run report, independent review had not yet occurred;
the locally accepted tally was **20/25**. These local results alone did not
establish full combined-tree verification, exact-SHA remote CI, owner UAT, a
complete accessibility audit or release approval.

## Independent agent review — 2026-10-16

An independent agent's scoped read-only code/evidence review, followed by
local coordination review, accepted the bounded F05 repair. The current
locally accepted finding count is **21/25 (84% by finding count)**, not a
coverage, effort, time or release-readiness percentage. The HTTP and browser
runs above were the Wallet worker's evidence; this review is not a human
accessibility audit, another full runtime run, exact-SHA remote CI, owner UAT,
publication or release approval. The non-snapshot limits and remaining gates
still apply; see [QA status](../../docs/qa-status.md).

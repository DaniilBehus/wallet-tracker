# OpenAPI and real-response checks — local report

[← Back to README](../../README.md#qa-evidence) · [API guide and requirements](../../docs/api/README.md) · [Next: contract cases →](test-cases.md#contract-checks--openapi-and-real-http)

Recorded 2026-09-28 UTC on the local work tree based on
`efa1c11bab1b6cceac5e112cbe195e89b2ff2440`. This is local evidence, not a
new GitHub CI result, owner UAT or measured model quality. Historical reports
remain unchanged. The API workflow has two additional local steps only;
publication and execution on GitHub are still pending.

## Scope and environment

Windows, Node 24.13.1, npm 11.8.0, Python 3.13.15 from the existing virtual
environment; Playwright Chromium and Selenium headless Chrome. The project
continues to promise Node 22+, not 24-only. The only architecture correction is
the stale Node 20+ wording to the already-existing package engine floor 22+,
with its paired SHA256; no business rule or frozen category acceptance changed.

The [OpenAPI document](../../spec/openapi.json) covers the explicit routes from
the real server and mounted routers. The focused inventory scanner documents
its supported syntax and refuses unsupported declaration forms. Swagger Parser
validates schema/local refs; separate checks enforce semantics that its
Swagger2 spec validator does not apply to OpenAPI3.

The [contract tests](../contract/contract.test.js) start two real local servers
(off and canned demo). Each uses a temporary SQLite file, new synthetic accounts,
random JWT secret, allow-listed environment and ephemeral loopback-only port.
No `.env` or existing database is loaded; inherited provider keys and live
configuration cannot select a live provider. The existing network guard is
loaded before application code. The demo factory is imported without running
the persistent demo launcher.

Strict Ajv8 with formats validates actual selected status/media/header/body,
with no coercion, defaults, field removal or schema fallback. Only the harmless
OpenAPI example annotation is added. Captures/logs stay in RAM, not tracked
JSON; assertions withhold response values. Validation checks capture immutability
and requires a success for every operation, not only a missing-auth denial.

## Observed status matrix

`check:openapi`: PASS 19/19 source-derived operations, 273 local refs.
`test:contract`: PASS 11 named tests, 244 validated real HTTP responses, 19/19
operations with at least one observed 2xx. Request totals include test setup;
they are not a count of test cases or production traffic.

| Operation | OBSERVED | Documented NOT EXERCISED |
|---|---|---|
| DELETE /api/transactions/{id} | 204,400,401,404 | 413,500 |
| GET /api/ai/capabilities | 200,401 | 400,413,500 |
| GET /api/categories | 200,401 | 400,413,500 |
| GET /api/health | 200 | 400,413,500 |
| GET /api/schedules | 200,401 | 400,413,500 |
| GET /api/settings | 200,401 | 400,413,500 |
| GET /api/summary | 200,400,401 | 413,500 |
| GET /api/transactions | 200,400,401,404 | 413,500 |
| PATCH /api/categories/{id} | 200,400,401,404 | 413,500 |
| PATCH /api/schedules/{id} | 200,400,401,404,409 | 413,500 |
| PATCH /api/schedules/{id}/pay | 200,400,401,404,409 | 413,500 |
| PATCH /api/transactions/{id} | 200,400,401,404 | 413,500 |
| POST /api/ai/expense-draft | 200,400,401,422,429,503 | 403,413,500,502,504 |
| POST /api/auth/login | 200,401,429 | 400,413,500 |
| POST /api/auth/register | 201,400,409,413 | 500 |
| POST /api/categories | 201,400,401,409 | 413,500 |
| POST /api/schedules | 201,400,401,404 | 413,500 |
| POST /api/transactions | 201,400,401,404,409 | 413,500 |
| PUT /api/settings | 200,400,401 | 413,500 |

AI 503 means observed `AI_UNAVAILABLE`, not provider busy. The three 200 draft
states ready/needs_input/unsupported were exercised with canned fixtures.
Live consent 403, upstream 502/504 and `AI_PROVIDER_BUSY` 503 are documented,
not observed by this offline suite. Generic500 is not deliberately induced.
AI writes no expenses here; quota counters can change. Budget tests cover
null/zero/ceiling and all four independent overall/category states.

## Validator controls, not production defects

Every capture control first passes its real HTTP baseline, changes only a
copy, checks the specific rejection kind/keyword, verifies no mutation and
rehashes/revalidates the unchanged original. Saved contract bytes are unchanged
before/after the test command. No production mutation or invented bug is claimed.

| Copied corruption | Required failure |
|---|---|
| Delete expense amount | body / required |
| Replace integer amount with string | body / type |
| Invent limit-state enum | body / enum |
| Give401 a CONFLICT code | body / enum |
| Remove429 Retry-After | header |
| Select undocumented418 | status |
| Replace JSON media with text/plain | media |
| Put content in204 | empty204 |

Inventory controls omit health or change pay PATCH to POST and must fail parity.
Scanner controls add quoted, all/chained/computed/dynamic and whitespace route
forms: supported static forms increase inventory and fail parity; unsupported
forms fail explicitly. A pure copied coverage matrix containing only401 for
one operation fails the success gate; it is not a fake HTTP observation.

The first partial implementation run had two test-harness errors (a summary
lookup used id instead of category_id; a rejection-message check mismatched).
Both were corrected in QA code. No production behavior or assertion was relaxed.

## Dependencies and audit delta

Three exact dev-only pins: `@apidevtools/swagger-parser@12.1.0`, `ajv@8.20.0`,
`ajv-formats@3.0.1`. Parser13 would raise the promised Node floor; parser12's
ref-parser14.0.1 remains compatible. Production lock entries are semantically
unchanged. Existing Ajv6.15.0/traverse0.4.1 used by Newman moved under
har-validator without a version change; root Ajv8/traverse1 are new dev tooling.

The before/after dependency audit during the installation stage retained the same 21 advisory package names:
8 moderate, 12 high, 1 critical; no new advisory was introduced by this graph change.
This does not make the dependency tree vulnerability-free. No audit fix or
unrelated upgrade was run. Gitleaks is not available locally; no full-history
secret scan is claimed.

## Full local regression

All twelve commands completed successfully on 2026-09-28 UTC. The only skip is
the existing Windows file-symlink privilege case in the AI suite; it is disclosed
below. The Playwright command uses two workers without changing test selection,
assertions or retries. k6 is not part of this run.

| Command | Actual result |
|---|---|
| npm run check | PASS: 8 gates, 0 skip/fail |
| npm run check:openapi | PASS: 19/19 source operations, 273 local refs |
| npm run test:contract | PASS: 11/11 tests, 244 real HTTP checks, controls including401-only copied matrix |
| npm run test:db | PASS: 6/6 |
| npm run test:api | PASS: 271 requests, 939 assertions, 271 executed scripts, zero failures/script errors |
| npm run test:python | PASS: 27/27 pytest items |
| npm run test:e2e -- --workers=2 | PASS: 186/186, 93 scenarios across two viewports |
| npm run test:race | PASS: 120 pairs per scenario; all invariant-violation counts zero |
| npm run test:ai | 236 PASS, 1 skipped, 0 failed; 237 total |
| npm run eval:ai | PASS: fixture mode, 116/116 rows; MODEL_QUALITY=NOT_MEASURED |
| npm run test:ai:e2e | PASS: 50/50, loopback fake adapter and canned demo |
| npm run test:selenium | PASS: 11/11 pytest items in headless Chrome |

AI skip: N1.4b file symbolic links require privilege on this Windows account;
directory-junction and hard-link checks ran and passed. Separate AI integration/
browser tests exercise the real adapter with a loopback fake, even where test
names say live mode; none is a call to a real provider.

The race runner measured two unkeyed rows in all 120 duplicate-POST pairs.
That scenario is explicitly measured, not an idempotency assertion. Registration
pairs were one201/one409 with no violations; pay/edit and edit/delete outcomes
were coherent, including the deliberately forced edit-first ordering.

Generated reports (Newman HTML, pytest XML, browser output, fixture and race
summaries) are ignored local artifacts, not newly tracked captures. Existing
API/race/e2e runners used their identified synthetic databases; no real default
wallet database or `.env` existed in this test checkout.

## Limitations

- Local results are not GitHub CI_GREEN or a publication result. New CI steps
  preserve the existing API job, jobs/permissions/triggers; raw captures are
  not uploaded as evidence.
- The parser gate is not a runtime response test; the HTTP test does not prove
  every documented status or every possible business-input combination.
- Fixture evaluation measures the application/evaluator, not an LLM.
  Real provider quality, paid calls and live error behavior remain unmeasured.
- No k6 rerun, penetration test, real-device/cross-browser/UAT acceptance or
  full-history secret scan is claimed. Existing dependency advisories remain.
- Ordinary unkeyed expense retry can duplicate rows; schedule pay is also
  intentionally not idempotent. The keyed expense contract is separate.
- The source-level next_due year10000 edge is disclosed, not HTTP-reproduced
  or silently fixed in production as part of this verification layer.

The core catalogue has 280 active IDs and 515 layer executions (512 current local,
3 historical k6). Its 11 contract entries are not expanded into 244 cases; race
iterations and the separate AI register/corpus are not added to that total.

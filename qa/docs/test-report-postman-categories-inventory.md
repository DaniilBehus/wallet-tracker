# Categories Postman inventory — bounded F19 family

[← Back to README](../../README.md#qa-evidence) · [Current Categories inventory](postman-categories-inventory.json) · [Prior Token family](test-report-postman-token-inventory.md)

**2026-10-13; local, uncommitted checkout at HEAD `b270355`.** The accepted [standalone validator](../../scripts/postman-inventory.js) was reused unchanged. This report covers only collection folder `03 · Categories` and catalogue section `## API · Categories`: seven requests, seven case rows TC-API-015–021 and seven reviewed declaration edges. It is **not** a Newman run, a new behavioral PASS, full F19 coverage, remote CI evidence or owner acceptance.

## Reviewed source links

The [reviewed mapping](../traceability/postman-categories.json) pins each exact folder/name/method/raw-URL selector, its full request/event fingerprint, the collection helper/auth context, the case-row fingerprint and a test marker. The [derived JSON](postman-categories-inventory.json) was generated from the unchanged [Postman collection](../api/wallet.postman_collection.json), [case catalogue](test-cases.md) and mapping. It reports `PARTIAL_STATIC_SOURCE_INVENTORY`, `NOT_RUN`, `NOT_CHECKED`, with no declared-only or source-only gaps **within this seven-case scope**. Request order and LF/CRLF are not identity.

| Case | Source-reviewed oracle and limit |
|---|---|
| TC-API-015 | Inherited bearer auth; `expectOk(200, 'categoryList')` checks status and schema, and an assertion requires a nonempty list after registration. |
| TC-API-016 | Explicit `tokenB` requests user B's list and checks it does **not** contain `catA`, the **first** user-A category ID stored by TC-API-015. The catalogue says none of **all** A IDs; that broader condition is **not** established by this source assertion. |
| TC-API-017 | Sends run-specific `QA {{runId}}` and 🧪, expects 201/category schema and the echoed name and icon. |
| TC-API-018 | Sends the same name/icon after creation, expects 409 `CONFLICT` and error schema. This depends on collection order. |
| TC-API-019 | Sends a name of **three spaces**, not a missing, empty or null name; expects 400 `VALIDATION_FAILED`. |
| TC-API-020 | Prerequest builds `'x'.repeat(61)` and body uses `{{name61}}`; expects 400 `VALIDATION_FAILED`. |
| TC-API-021 | Prerequest builds a run-specific 60-character name; expects 201/category schema and returned name length 60. |

The collection-level helper defines `expectOk` as status plus JSON schema and `expectError` as status, error schema/code and non-500. The collection prerequest also defines `categoryList`/`category` schemas and unique `runId` values; those definitions were inspected and fingerprinted, **not executed** here. The static validator establishes source identity and declared edges, not whether every expected condition is semantically complete or whether the API behaves as described. Historical `PASS` labels in the case catalogue remain historical; this task did not rerun them.

## Commands and controls

Using the verified local Node 22.14.0 executable:

- `node scripts/postman-inventory.js --collection qa/api/wallet.postman_collection.json --catalogue qa/docs/test-cases.md --mapping qa/traceability/postman-categories.json --output qa/docs/postman-categories-inventory.json`: **7 requests / 7 cases / 7 edges**, static `NOT_RUN`.
- `node --test qa/gates/postman-categories-inventory.test.js qa/gates/postman-token-inventory.test.js qa/gates/postman-inventory.test.js`: **21/21 PASS** (Categories 7, Token 6, Health 8). In-memory negatives reject unknown/nonpilot IDs, missing edge/row, removed/moved/extra requests, token-B auth/body/assertion/boundary drift, duplicate selectors/annotations and malformed/empty inputs. Positives accept reorder, CRLF and a legitimate extra request for an already mapped case. The saved Categories JSON was deep-compared with a fresh build.
- `node scripts/traceability.js`: static **280 case IDs / 78 rule definitions**; no semantic or runtime claim.
- `node scripts/check.js`: **8 pass / 0 skip / 0 fail** static gates.

SHA-256: collection `2f231d50879f2264bd904cc4a12577ab47474147a9687b4fb0f61907fd4f120b`; catalogue `a2d1ff0cb206113ac82ec8f6014a5d17d7627265a26602dd6cb81f52962b512d`; Categories mapping `593ab3362dcc35a350b967fec08647694b8b6f0a09c32d4b19b2ddb29ec27477`; derived JSON `07ceeb49caf1ed6db14600bffca6fc847046ee951121efbd954aef38ddb8137a`.

No collection script, catalogue row, validator, runner, product code or CI file was edited. Other API families and test layers are `NOT_CHECKED`; full F19 remains **OPEN**, with the prior project tally **17/25 unchanged**. No commit or push was made.

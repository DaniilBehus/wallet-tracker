# Transactions Postman inventory — bounded F19 family

[← Back to README](../../README.md#qa-evidence) · [Current Transactions inventory](postman-transactions-inventory.json) · [Prior Categories family](test-report-postman-categories-inventory.md)

**2026-10-14; local, uncommitted checkout at HEAD `b270355`.** The accepted [standalone validator](../../scripts/postman-inventory.js) was reused unchanged. This report covers only collection folder `04 · Transactions` and catalogue section `## API · Transactions`: 21 requests, 21 case rows TC-API-022–042 and 21 reviewed declaration edges. It is **not** a Newman/API run, a new behavioral PASS, full F19 coverage, CI evidence or owner acceptance.

## Reviewed source links

The [reviewed mapping](../traceability/postman-transactions.json) pins each exact folder/name/method/raw-URL selector, its full request/event fingerprint, the collection helper/auth context, each case-row fingerprint and a test marker. The [derived JSON](postman-transactions-inventory.json) was generated from the unchanged [Postman collection](../api/wallet.postman_collection.json), [case catalogue](test-cases.md) and mapping. It reports `PARTIAL_STATIC_SOURCE_INVENTORY`, `NOT_RUN`, `NOT_CHECKED`, with no declared-only or source-only gaps **within this 21-case scope**. The collection-level helper supplies status/schema/error checks and inherited user-A bearer auth; the Delete-as-B request explicitly overrides that auth. These definitions were inspected and fingerprinted, **not executed** here.

| Cases | Source-reviewed request/assertion scope |
|---|---|
| TC-API-022 | Posts integer 1250 cents without `spent_on`; expects 201, exact returned amount and date equal to the test script's **local** calendar date. This is not timezone-boundary proof. |
| TC-API-023–029 | Posts zero, one, collection-variable ceiling `100000000`, ceiling + 1, fractional `12.5`, string `"1250"` and missing amount. The accepted/rejected status and schema assertions match the individual case rows; the one-cent case stores `txOneCent` for later deletion. |
| TC-API-030–033 | Truncated JSON expects 400/error JSON content type, not 500; malformed date expects 400; prerequest constructs a local date **30 days** ahead and expects 400; posting user-B category ID under user-A auth expects 404, explicitly not 403. |
| TC-API-034 | No date query; expects a transaction list containing `txA` and `spent_on` values sorted descending. There is **no explicit out-of-month exclusion fixture or same-date secondary-sort proof**. |
| TC-API-035–038 | `limit=201` expects 400; `limit=200` expects 200/list schema (not an asserted 200-row count); reversed fixed date range expects 400; filtering by user-B category under user-A auth expects 404, not 403. |
| TC-API-039–042 | Explicit `tokenB` attempts to delete `txA` and expects 404/not 403, but has **no independent readback proving row survival**. Deleting own `txOneCent` expects 204/empty body; repeating it expects 404; a nonnumeric ID expects 400. The create/delete/repeat evidence depends on execution order. |

Static request reordering is accepted as an inventory identity control, **not** as evidence that the runtime collection can execute in any order. Historical `PASS` labels in the case catalogue remain historical; this task did not rerun the API or strengthen their assertions.

## Commands and controls

Using the verified local Node 22.14.0 executable:

- `node scripts/postman-inventory.js --collection qa/api/wallet.postman_collection.json --catalogue qa/docs/test-cases.md --mapping qa/traceability/postman-transactions.json --output qa/docs/postman-transactions-inventory.json`: **21 requests / 21 cases / 21 edges**, static `NOT_RUN`.
- `node --test qa/gates/postman-transactions-inventory.test.js qa/gates/postman-categories-inventory.test.js qa/gates/postman-token-inventory.test.js qa/gates/postman-inventory.test.js`: **29/29 PASS** (Transactions 8, Categories 7, Token 6, Health 8). In-memory negatives reject unknown/nonfamily IDs, missing edge/row, removed/moved/extra requests, changed money type/ceiling, future-date construction, token-B auth, query URL, response assertions and shared helper, duplicate selectors/annotations and malformed/empty inputs. Positives accept source reorder, CRLF and an extra distinct request for one mapped case. The saved Transactions JSON was deep-compared with a fresh build.
- `node scripts/traceability.js`: static **280 case IDs / 78 rule definitions**; no semantic or runtime claim.
- `node scripts/check.js`: **8 pass / 0 skip / 0 fail** static gates.

SHA-256: collection `2f231d50879f2264bd904cc4a12577ab47474147a9687b4fb0f61907fd4f120b`; catalogue `a2d1ff0cb206113ac82ec8f6014a5d17d7627265a26602dd6cb81f52962b512d`; Transactions mapping `40e23c2f7cdf0c64bc49d56cc8620dd10cabaad33442dc5ce0a5eca83d69c784`; derived JSON `6457dd4336707cdd5598b0f168e3ac2a0fb586af6e7cf1d40b96b4e06b66e522`.

No collection script, catalogue row, validator, runner, product code, package or CI file was edited. Other API families and test layers are `NOT_CHECKED`; full F19 remains **OPEN**, with the prior project tally **17/25 unchanged**. No commit or push was made.

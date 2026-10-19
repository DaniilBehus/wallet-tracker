# Health/registration Postman inventory — bounded F19 pilot

[← Back to README](../../README.md#qa-evidence) · [Current source inventory](postman-health-inventory.json) · [Next: QA status →](../../docs/qa-status.md)

**2026-10-13; local, uncommitted checkout at HEAD `b270355`.** This is a static source-to-catalogue mapping for the exact Postman folder `01 · Health and registration` and its matching catalogue section. It does not execute Newman, establish current PASS results, complete F19, verify CI, or change owner UAT/skills.

## Reviewed scope and mechanism

The unchanged collection has 12 requests in that exact folder; the unchanged catalogue section has 12 active rows: TC-API-001–009 and TC-API-106–108. Every current request is linked to at least one reviewed case, and every scoped catalogue case has a request edge. Current generated counts are **12 requests, 12 cases, 12 edges**; the counts are derived from the inputs, not a copied project-wide coverage percentage.

The [reviewed mapping](../traceability/postman-health.json) names the exact folder, request name, method and raw URL. Each edge records the SHA-256 fingerprint of its complete request/event payload, a test-script marker and a human-reviewed oracle reason. The mapping separately pins the collection-level helper/auth context and each case row's text. The [standalone validator](../../scripts/postman-inventory.js) reads JSON structurally; its Markdown handling is deliberately bounded to first-cell TC IDs and the exact pilot section. Request order and LF/CRLF formatting are not identity. Duplicate selectors or case annotations fail; one case may legitimately have several distinct request edges.

The [generated JSON](postman-health-inventory.json) contains source paths and SHA-256 hashes, selectors, edges, `declaredOnly`/`sourceOnly` gaps and explicit `PARTIAL_STATIC_SOURCE_INVENTORY`, `NOT_RUN` and `NOT_CHECKED` markers. Those markers are intentional: the remaining Postman folders and other test layers are **not checked** by this pilot.

## Local verification

| Command / control | Result |
|---|---|
| `node --test qa/gates/postman-inventory.test.js` | Final 8/8 PASS. Positive fixtures cover LF/CRLF, request reorder and a legitimate second request mapped to the same case. |
| Negative fixture controls | Deleted/moved request; unknown/nonpilot ID; duplicate, deleted, changed or new unreviewed catalogue row; missing edge; changed request assertion or shared helper; extra/duplicate request; conflicting selector; repeated annotation; empty/malformed inputs; malformed TC ID inside and outside the pilot; ambiguous/missing section boundary; output/input path collision all fail closed. |
| `node scripts/postman-inventory.js --collection qa/api/wallet.postman_collection.json --catalogue qa/docs/test-cases.md --mapping qa/traceability/postman-health.json --output qa/docs/postman-health-inventory.json` | Generated the current 12/12/12 JSON from the unchanged inputs. Output is written only after validation and cannot target one of its three source inputs. |
| `node scripts/traceability.js` | Existing F13 static checker PASS: 280 case IDs and 78 rule definitions; no execution claim. |
| `node scripts/check.js` | Existing static gates 8 PASS, 0 skipped. |

The test-first missing-module failure was setup red, **not** reproduction of an existing product defect. A new fixture then exposed a real first implementation gap: malformed `TC-API-10` in a neighboring section was silently omitted from the whole-catalogue known-ID set. The parser was tightened; an initially over-narrow ID grammar also rejected valid `TC-E2E-001`, then was corrected. Final 8/8 is after both fixes. No collection scripts, catalogue rows or product files were modified.

Input SHA-256 values in the generated artifact: collection `2f231d50879f2264bd904cc4a12577ab47474147a9687b4fb0f61907fd4f120b`; catalogue `a2d1ff0cb206113ac82ec8f6014a5d17d7627265a26602dd6cb81f52962b512d`; reviewed mapping `2e5471e432a1434ed0cfb6721cfbbcdc84ec39d9bfe2feefce96efcf2cd33dff`. Generated inventory SHA-256: `816f35a4afd0c13fc623952df98bc8e53871aef43e007cfca126f2e40ce191c5`.

## Limits and next decision

A request-to-case edge is a reviewed declaration, not behavioral coverage. The collection's assertions were not executed here, and mapping does not by itself prove that every sentence of a catalogue Expected cell is asserted. For example, TC-API-107's request asserts 400/`VALIDATION_FAILED`; this static pilot does not independently prove the catalogue's further “no account is created” statement. Historical PASS rows are unchanged and are not reclassified as new results.

F19 remains OPEN. The other API folders, load tests, executable browser/Python/DB/Selenium links, provisional import and supporting controls require separate scoped review. The broader release gate, remote CI and owner acceptance remain untouched. No commit or push was made in this pilot.

**English** · [Slovenčina](../../locales/sk/qa/docs/test-report-postman-api-inventory.md)

# Postman API source inventory — 2026-10-14

[← Back to README](../../README.md#qa-evidence) · [Case catalogue](test-cases.md) · [Derived inventory](postman-api-inventory.json)

## Scope and result

**STATIC_SOURCE_INVENTORY / NOT_RUN.** This is a source-to-case accounting check, not an API execution report. It reuses the four previously reviewed [Health, Token, Categories, and Transactions mappings](../traceability/) without changing them, and reviews the other ten collection folders in one [batch manifest](../traceability/postman-api-batch.json). The source is the [Postman collection](../api/wallet.postman_collection.json); case claims are checked against the existing [catalogue](test-cases.md). Editing, AI, and synthetic-import identities live in a separate [source-only register](../traceability/postman-api-extended-cases.json), not in the owner-approved catalogue.

| Accounting unit | Count | Meaning |
| --- | ---: | --- |
| Collection requests | 271 | 45 accepted previously + 226 reviewed in this batch. |
| Active main TC-API rows | 141 | Each has at least one source-declared assertion edge. |
| Extended source-only cases | 30 | 18 Editing + 12 AI/keyed; not owner-approved requirements. |
| Provisional import declarations | 3 | Offline caller-supplied synthetic data, not a bank/provider integration. |

The **226 new request nodes** divide into 188 `business_assertion`, 30 `case_arrange`, 2 `case_cleanup`, 3 `supporting_control`, and 3 `provisional_import`. The 45 previously accepted requests are business assertions, making the **combined 271** classes 233, 30, 2, 3, and 3 respectively. These are request-node classes, not case counts or passed-test counts. Login has six requests covering seven catalogue rows, so the accounting is deliberately not one-to-one. The complete inventory reports no unclassified request, missing main case, or missing extended declaration; `completeApiAccounting` is true **only for this structural API inventory**.

One source-review correction is material: the request titled `TC-API-131 · zero-spend limited category listed` is a PATCH that sets `monthly_limit_cents` to 20000 and checks the echoed field. It is `case_arrange`, not proof that a zero-spend category appears. The following GET summary checks the category IDs, order, and total and is the `TC-API-131` business assertion.

## Verification

Commands below use the repository's available Node 22.14.0 runtime. They do not start the server or call an API.

```text
node scripts/postman-api-inventory.js --check
node --test qa/gates/postman-api-inventory.test.js qa/gates/postman-transactions-inventory.test.js qa/gates/postman-categories-inventory.test.js qa/gates/postman-token-inventory.test.js qa/gates/postman-inventory.test.js
node scripts/traceability.js
node scripts/check.js
```

The combined pure controls passed **37/37** (8 new, 29 existing). Negative fixtures reject removed, moved, added, or changed requests; body/auth/prerequest/assertion/helper drift; bad or duplicate catalogue, register, and mapping IDs; unknown or wrong-family edges; a missing setup/control node; malformed/nested input; stale generated output; and output/source collisions. Positive fixtures accept different-body requests with the same display name as distinct full identities, multiple requests per case, multiple supported cases per request, reordering, and LF/CRLF normalization. These are in-memory structural controls, not product behavior tests. The [new control file](../gates/postman-api-inventory.test.js) and [checker](../../scripts/postman-api-inventory.js) contain the exact assertions.

The checker pins the collection's shared and folder contexts, complete request/event fingerprints, catalogue-row hashes, and the four accepted mappings. The derived JSON includes raw SHA-256 values and repository-relative source paths. `reviewedClassificationsSha256` detects accidental manifest metadata drift but is a **self-consistency check**, not independent proof that a human chose the right oracle. A deliberate but wrong reclassification can be re-pinned. Source script text is inspected, not evaluated, and unsupported nested collection shapes fail closed.

## Limits and unresolved evidence

- `TC-API-016` checks the first user-A category ID, not every A-owned ID. `TC-API-022` does not prove a timezone-boundary date. `TC-API-034` lacks an explicit out-of-month exclusion fixture and same-day secondary-sort proof. `TC-API-039` lacks an independent foreign-row survival readback. `limit=200` tests an upper bound, not a promise of exactly 200 returned rows.
- `TC-API-047` chooses one next-February scenario per execution; it does not execute both leap and non-leap years. `TC-API-109` uses amount `99999999` times 1200, although the catalogue says “at amount ceiling” (`100000000`). The arithmetic assertion does not establish that exact ceiling fixture. The `forEach` assertions in `TC-API-052/053` would be vacuous on an empty list without their preceding fixtures. `TC-API-059` checks foreign pay as 404/not-403 without an independent state readback. `TC-API-060` assumes the fixed ID `99999999` does not exist and expects 404.
- Static request reordering tolerance does not certify runtime prerequisites or setup order. The AI/keyed requests check the declared local modes and saves, not an external provider. Synthetic import is explicitly provisional. No Newman, HTTP, product, browser, database, CI, or UAT run occurred in this batch.

**API-only source accounting is complete; full F19 remains OPEN.** The earlier 17/25 tally is unchanged. Other test layers, runtime behavior, and CI binding remain `NOT_CHECKED` here. No historical PASS label has been promoted or rewritten by this inventory.

## 2026-10-15 — targeted Login oracle repair (ORD-104)

The independent ORD-103 review accepted the structural 271-node inventory but **withheld the all-141-row oracle claim**: TC-API-071 used a fresh unregistered email with another account's password, and TC-API-073 logged in on a different email without observing a reset. The source and its classification pins were repaired; the original batch record above is retained as history.

The Login folder now uses the already registered `emailA` as `rlEmail` throughout the blocking sequence. The correct-password attempt at TC-API-071 is therefore meaningful. After the block expires, one same-account 401 seeds a new window. TC-API-073 logs into that same account successfully, then sends five sequential wrong-password requests that must each return 401, followed by a sixth that must return 429. A conservative elapsed-time guard requires these observations to finish before the original seeded window expires; otherwise natural expiry could masquerade as a reset. This checks both email and client-IP buckets as observed through the API, without a test-only reset endpoint.

The [focused pure control](../gates/login-oracle-controls.test.js) first failed 4/4 against the old Login source. After the repair it passed 4/4: a deterministic cleared-counter model passes, while no-clear, wrong-account, and expired-window models fail. The full set of source controls passed **41/41** (37 previous + 4 new); aggregate `--check`, static traceability (280 catalogue IDs / 78 rule definitions), and `scripts/check.js` (8/8) passed. The four previously accepted mapping files were unchanged; their derived JSON artifacts were regenerated solely because the collection's raw SHA-256 changed.

One full Newman run used the existing `qa/api/run.js` with a sanitized child environment, its own disposable database and generated secret, AI mode off, no external base URL, and loopback port 52079. Configured `LOGIN_MAX_FAILURES=5` and `LOGIN_WINDOW_MS=12000`. The existing ignored HTML/JUnit reports were copied first to `qa/reports/ord-104-backup-2026-10-15/` and verified by SHA-256; the runner then wrote its own ignored reports at `qa/reports/api-report.html` and `qa/reports/api-junit.xml`. No real account, provider, database, CI, or external endpoint was used.

| Newman measure | Executed | Failed |
| --- | ---: | ---: |
| HTTP requests | 280 | 0 |
| Assertions | 951 | 0 |
| Test scripts | 274 | 0 |

The 280 runtime HTTP requests are **not** the 271 collection source nodes: the Login loop and TC-API-073 callback probes issue repeated/additional requests. This successful local run supports the repaired 071/073 behavior under the stated window and fixture; it does not certify every other catalogue expected condition, CI, UAT, or all F19 layers. Full F19 stays **OPEN**, and 17/25 remains unchanged pending independent targeted review and separate layers.

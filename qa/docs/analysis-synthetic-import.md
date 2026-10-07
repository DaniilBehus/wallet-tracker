# Synthetic expense import — provisional analysis

> Agent-authored proposal for a personal-project demonstrator. The owner has not reviewed or accepted these business choices. No bank connection, real external account, or real transaction data is in scope.

[← Back to README](../../README.md) · [Architecture](../../spec/architecture.md) · [Next: API contract →](../../spec/openapi.json)

[Local regression note](test-report-synthetic-import.md)

## Goal and boundary

Let an authenticated person inspect up to ten synthetic external expense records, then explicitly confirm them into Wallet. Preview is read-only. Confirmation uses the existing transaction and keyed-save contracts; it must never create half a batch or duplicate an external record after a lost response.

The source is the fixed identifier `synthetic-demo-v1`. The product API accepts caller-supplied JSON, **not an external provider connection**. It makes no provider request and has no provider credential, file upload, scheduled sync, or automatic save. A separate, test-only loopback adapter and disposable HTTP stub exercise timeout, malformed response and authorization-denial handling; they are not connected to a public route or product flow and do not establish real-provider integration experience.

## Provisional decisions for owner review

- **P1 — all or nothing:** one invalid, unknown-category, or conflicting record rejects the entire confirm batch. No partial success. Preview rejects the same invalid input without writing anything.
- **P2 — unknown categories:** a category name must match exactly one category owned by the signed-in user. No silent creation, guessing, uncategorised fallback, or cross-user lookup.
- **P3 — identity:** `(user_id, source, external_id)` identifies one imported record. Reusing it with different amount, date, category name, or note is a visible `409` conflict. Repeating the same record returns the original transaction identity, not another expense. A deleted original remains a tombstone and cannot be recreated by retry.
- **P4 — no persisted preview:** preview does not reserve records or grant approval. Confirm revalidates the submitted batch against current data. The browser requires an explicit review/Confirm action; an API caller can invoke confirm directly. A server-enforced preview token is outside this first slice.
- **P5 — small fixed scope:** one source and at most ten records per request. This is not a bulk importer, CSV parser, bank connector, or general-purpose synchronisation service.

## Request and response outline

`POST /api/imports/preview` and `POST /api/imports/confirm` require the normal bearer token and inherit `X-Request-Id` and the standard JSON error shape. Both receive exactly:

```json
{
  "source": "synthetic-demo-v1",
  "records": [
    {
      "external_id": "sample-grocery-001",
      "amount_cents": 3500,
      "spent_on": "2026-09-29",
      "category_name": "Groceries",
      "note": "Synthetic example"
    }
  ]
}
```

The sample values are fictitious; `3500` means €35.00. No real names, contacts, account numbers, or merchant records belong in fixtures or logs.

- Require a JSON object with exactly `source` and `records`; require 1–10 records and distinct external IDs within the batch. Reject extra fields, empty arrays, and unsupported sources.
- Require each record's exact fields above, except `note` may be omitted or `null`. `external_id` is 1–64 ASCII letters, digits, `_` or `-`; the optional note is bounded to 160 characters. These input bounds are provisional.
- `amount_cents` is a positive integer JSON **number** within the existing amount ceiling. A quoted number, float, zero, negative, or out-of-range value is invalid. No EUR conversion or rounding occurs.
- `spent_on` is a valid local `YYYY-MM-DD` date and obeys the existing expense date bound. `category_name` is an exact non-empty owned-category name; a missing or another user's category is unavailable, not mapped to their ID.
- Preview returns normalised records with the resolved owned category and a `new` or `already_imported` indication. It creates no transaction, request ledger row, or preview row. A conflicting external identity returns `409` without a write.
- Confirm returns each transaction ID and whether it was newly created or replayed; a repeated batch yields the same IDs and no new transactions. The response does not contain credentials, raw upstream payloads, or another user's records.

## Atomicity and retry design

The existing [`transaction_requests` ledger](../../src/schema.sql), keyed transaction save path, and tombstone behaviour are the source of truth. Derive a stable 8–64-character operation key from the fixed source and external ID, scoped by the existing ledger's `user_id`. Its `import_` prefix is deliberately outside the public `Idempotency-Key` alphabet to prevent an ordinary expense save from claiming an import identity. Compare a canonical fingerprint of **all externally supplied semantic fields** before accepting a replay; changes must not be silently overwritten. Reuse the keyed transaction-save core; do not build a second independent deduplication store.

Confirm must process the entire batch inside one SQLite `BEGIN IMMEDIATE` transaction. Nested keyed-save helpers may be savepoints, but an uncaught error must roll back all writes in the outer transaction. The browser must not chain independent `POST /api/transactions` calls: that would permit a partially saved batch. A disconnected client or simulated lost response may retry with the same source/IDs and receive the existing result. Preview may read existing ledger entries, but must not mutate them.

## Traceability and evidence to add with implementation

| Requirement | Automated proof |
|---|---|
| PRE-1 Preview is read-only | Compare transaction and key-ledger rows before/after preview, including failure. |
| VAL-1 Strict shape, integer cents, date and owned category | Invalid type/bounds/date/category/extra-field API cases create zero writes. |
| AT-1 Confirm is all-or-nothing | Later record fails after an earlier valid one; no expense or key remains. |
| ID-1 Same external identity retries safely | First confirm, same-batch replay and simulated lost response produce one expense per ID. |
| ID-2 Changed content conflicts | Same ID with changed amount/date/category/note returns `409`, with no overwrite. |
| ISO-1 Per-user isolation | Two users may use one external ID without sharing results; a foreign category is refused. |
| UI-1 Explicit review before save | Browser test checks preview alone leaves counts unchanged; only Confirm saves. |

The fixed synthetic-demo browser action opens a review dialog on Add. It sends preview first, keeps Confirm disabled until review succeeds, and sends confirm only after an explicit click. The demo uses a generated external ID and requires the starter `Groceries` category; if it is missing, the demo refuses rather than copying a custom category name into local storage. Its pending synthetic batch is kept locally under that account's numeric ID until a confirmed response, so a lost response followed by a reload/reopen retries the **same** external ID; no token or real transaction text is copied into this draft. It is not a general JSON editor or external connector. The dedicated offline test command is `npm run test:import`; the API CI job runs that command. The browser test is `qa/e2e/synthetic-import.spec.js`. Neither local commands nor CI wiring are evidence of a green remote run for the new commit.

Before claiming implementation complete, update the OpenAPI contract, source-operation and real-response checks, request collection, browser tests, README route, and the relevant CI suites. Record actual local results; do not call them GitHub CI results without an exact-SHA run. Owner acceptance remains pending until the owner performs and records their own review.

## Offline HTTP boundary — isolated test demonstrator only

The committed product still accepts caller-supplied synthetic JSON; no public route or product flow makes a provider HTTP request. A local-only adapter module and disposable-stub tests now exercise a real loopback request followed by the existing read-only preview. They are not a bank connector or a claim of external-provider experience. The owner must review the assumptions below before this becomes product behaviour.

- The adapter's target is a fixed `http://127.0.0.1` loopback stub chosen by the test/demo setup, never a URL supplied by an API caller. Redirects and external hosts are refused. Any authorization value is fake, disposable, and absent from responses, logs, and committed configuration.
- One request has a finite deadline and a capped response body; the adapter rejects an oversized body before parsing it. It accepts only a JSON object containing 1–10 records that strictly map to the existing `synthetic-demo-v1` preview shape, including numeric integer `amount_cents`, valid dates, and bounded fields. The existing preview remains the final owner/category/conflict validator.
- Timeout, transport failure, non-2xx (including authorization refusal), invalid JSON, invalid field shape/type, too many records, or oversized response produce a safe, generic error without the stub authorization value or raw payload. Exact HTTP status mapping and the numeric deadline/body cap are **provisional owner-review decisions**, not established product contracts. No automatic retry or save occurs.
- Every failed fetch or preview leaves Wallet transactions and the request ledger unchanged. A successful fetch only feeds the existing read-only preview; saving still requires a later explicit Confirm through the existing atomic, per-user idempotent path. A lost Confirm response is retried with the same external IDs, never regenerated IDs.

The isolated tests must prove: real loopback request → validated read-only preview → explicit confirm; timeout, non-2xx/authorization refusal, malformed JSON, invalid record, record-count and byte-limit rejection with zero writes; no fake authorization or payload leakage; lost-response replay without duplicate expenses; and isolation of identical external IDs and categories across two users. These tests do not establish a public connector or an owner-accepted product rule.

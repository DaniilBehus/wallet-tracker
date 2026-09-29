# Synthetic expense import — provisional analysis

> Agent-authored proposal for a personal-project demonstrator. The owner has not reviewed or accepted these business choices. No bank connection, real external account, or real transaction data is in scope.

[← Back to README](../../README.md) · [Architecture](../../spec/architecture.md) · [Next: API contract →](../../spec/openapi.json)

## Goal and boundary

Let an authenticated person inspect up to ten synthetic external expense records, then explicitly confirm them into Wallet. Preview is read-only. Confirmation uses the existing transaction and keyed-save contracts; it must never create half a batch or duplicate an external record after a lost response.

The source is the fixed identifier `synthetic-demo-v1`. This is a caller-supplied batch-import API, **not an external provider integration**. The API accepts only this source and synthetic JSON. No provider request, credential, file upload, scheduled sync, or automatic save is implemented. A local HTTP provider stub/adapter, timeout mapping, malformed upstream response and upstream authorization checks remain a separate unimplemented step; this slice must not be cited as evidence of external integration skill.

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

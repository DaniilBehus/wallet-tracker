# API contract and executable evidence

[← Back to README](../../README.md#qa-evidence) · [Next: local contract report →](../../qa/docs/test-report-contract.md)

The [OpenAPI 3.0.3 document](../../spec/openapi.json) describes the implemented
REST API. It is not a hosted Swagger service or a production API claim.
The version is selected for parser compatibility, not described as the latest.

## Where to go

| Read or check | Open |
|---|---|
| Methods, fields, headers and documented statuses | [Machine-readable contract](../../spec/openapi.json) |
| Architecture and business rules | [Architecture](../../spec/architecture.md) · [category limits](../../qa/docs/analysis-category-limits.md) · [AI draft](../../spec/ai-expense-entry.md) |
| Actual implementation | [Server and auth mounts](../../src/server.js) · [routers](../../src/routes/) · [validation](../../src/validate.js) |
| Check contract drift | [Source/schema gate](../../scripts/lib/openapi.js) · [entry command](../../scripts/check-openapi.js) |
| Test real HTTP responses | [11 named tests](../../qa/contract/contract.test.js) · [strict response validator](../../qa/contract/response-validator.js) |
| Results and remaining coverage limits | [Local report](../../qa/docs/test-report-contract.md) · [case register](../../qa/docs/test-cases.md#contract-checks--openapi-and-real-http) |

## Run safely

```bash
npm ci
npm run check:openapi
npm run test:contract
```

No manual server, `.env`, API key or existing database is needed. The response
tests create temporary SQLite databases, synthetic accounts, random secrets and
loopback-only servers. They use AI off and the existing canned demo provider,
with the network guard loaded in the test process and server processes.
Captures remain in memory; output reports observed status sets, not response
bodies, passwords or bearer tokens.

The source scanner is deliberately focused: literal app/router methods and the
current protected mount form. Unsupported quote/mount, computed, all/chained or
dynamic declarations fail rather than silently disappear. Whitespace around
the dot is tested. It is not a universal JavaScript/Express interpreter.

Swagger Parser validates structure and local refs with external/file/http
resolution disabled and circular refs refused. Additional checks validate
method/path parity, unique IDs, effective auth, parameters, typed responses,
required correlation headers and empty204. Parser's Swagger2-specific spec
validation does not supply those OpenAPI3 checks.

Ajv8 plus formats validates the selected actual status, media and headers.
`strict` is true; coercion, defaults and extra-field removal are false. Only
the harmless OpenAPI `example` annotation is registered; unknown validation
keywords fail. No broad adapter, permissive fallback or response cleanup is
used. Every implemented operation needs an observed success, not merely401.

## Synthetic request examples

Use a disposable local account, not personal data. Bodies below are examples,
not a recorded request; replace dates with your server's local date where noted.
Registration/login returns a token that stays local and must not enter a report.

```http
POST /api/auth/register
Content-Type: application/json

{"email":"example@wallet.test","password":"synthetic-example-password"}
```

Authenticated requests use `Authorization: Bearer <local-token>`; the bracketed
text is a placeholder, not a credential. Money is integer cents.

```http
POST /api/transactions
Content-Type: application/json
Authorization: Bearer <local-token>
Idempotency-Key: synthetic-save-0001

{"amount_cents":1250,"spent_on":"2026-09-28","category_id":null,"note":"Synthetic lunch"}
```

For a new keyed save, use a valid date no later than server tomorrow. A successful
creation returns201. Repeating the same canonical payload and key returns the
stored creation snapshot with `Idempotency-Replayed: true`, even after editing
the row. Changed payload with that key returns409 `IDEMPOTENCY_CONFLICT`;
deleted original returns409 `IDEMPOTENCY_REPLAY_UNAVAILABLE`. Ordinary unkeyed
POST and schedule payment do not promise idempotency.

```json
{"error":{"code":"VALIDATION_FAILED","message":"amount_cents must be a positive integer number of cents"}}
```

This illustrates the nested error shape, not a guaranteed verbatim message.
Each response has `X-Request-Id`, a lowercase UUID. Ordinary errors do not add
that ID to their body; an AI draft does and must match the header.

```http
PATCH /api/categories/1
Content-Type: application/json
Authorization: Bearer <local-token>

{"monthly_limit_cents":0}
```

ID1 is illustrative: obtain your own category ID from GET categories. Null
clears a budget; zero is a real budget. Independent category/overall limits
judge current or historical month totals on read and never block a valid save.

## Implementation details that schemas alone do not express

- Ordinary create POST/settings PUT ignore extra fields; editing PATCH on
  categories, transactions and schedules refuses empty objects and unknown or
  server-owned fields. PATCH schedule pay ignores its body and does not require
  a nonempty object. AI draft POST requests are exact-key objects too.
- Names are checked after trim using JavaScript UTF-16 length. Registration
  trims/lowercases email with the application regex; the password minimum is
  eight UTF-16 units and its ceiling is72 UTF-8 bytes, not72 characters.
- Category IDs use Number conversion and ownership checks. Category icon and
  expense note use String(non-null JSON); those coercions are not hidden behind
  falsely integer-only/string-only request schemas. Missing/foreign IDs use404.
- Unkeyed expense date omitted/null defaults to today; keyed saves require an
  explicit date; PATCH null date is invalid. Dates are local, not UTC timestamps.
  Expense `created_at` is SQLite text, not an RFC3339 date-time.
- A schedule's active flag is integer0/1. Subscription remaining fields are
  null. PATCH pay can write another instalment on a repeat; it is not a replay.
  `next_due` is formatted calendar text; the source-level year10000 edge is
  disclosed in the contract, not presented as an observed HTTP result.
- AI text is NFC-normalized before its500-code-point ceiling. Raw JSON body
  over8192bytes gives400 (global100KiB parsing limit gives413). Reference date
  must be server yesterday/today/tomorrow. Live consent, own category context,
  quotas and provider output are checked in order. Drafts do not write expenses,
  but quota reservations do write counters. Process concurrency is not a
  multi-process guarantee. Demo fixtures are not measured model quality.

## Requirements for the contract checks

These are verification requirements for this layer, not new product features.

| ID | Requirement | Evidence |
|---|---|---|
| REQ-CONTRACT-01 | Local-ref OpenAPI and source operation/auth/parameter parity; fail drift | [Gate](../../scripts/lib/openapi.js), TC-CONTRACT-002 |
| REQ-CONTRACT-02 | Typed selected status/media/header; empty204; no mutation/fallback | [Validator](../../qa/contract/response-validator.js), TC-CONTRACT-001/010 |
| REQ-CONTRACT-03 | Actual success and meaningful denial/bounds/ownership/state scenarios | TC-CONTRACT-003…009 in [tests](../../qa/contract/contract.test.js) |
| REQ-CONTRACT-04 | Disposable offline environment, no inherited provider keys or captured JWT logs | [Harness](../../qa/contract/support.js), TC-CONTRACT-001/008/011 |
| REQ-CONTRACT-05 | Real-capture/inventory controls reject corruption; originals remain unchanged | TC-CONTRACT-002/010 |
| REQ-CONTRACT-06 | Observed success for every source operation; unexercised statuses explicit | TC-CONTRACT-011, [matrix](../../qa/docs/test-report-contract.md#observed-status-matrix) |

Follow the evidence: [requirement](#requirements-for-the-contract-checks) →
[implementation decision](#run-safely) → [test](../../qa/contract/contract.test.js) →
[result](../../qa/docs/test-report-contract.md) → [limits](../../qa/docs/test-report-contract.md#limitations).

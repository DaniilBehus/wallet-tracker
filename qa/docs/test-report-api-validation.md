# Safe numeric and text input — local HTTP regression, 2026-10-09

[← Back to README](../../README.md#qa-evidence) · [Run commands](../../docs/testing.md) · [Contract tests](../contract/contract.test.js) · [OpenAPI contract](../../spec/openapi.json)

Base HEAD: `b270355c8c850282b10cc0a7bdeb81c88b784765` plus earlier local validator-control changes and this validation slice, all **uncommitted**. The HTTP observations below used the existing contract harness: real loopback Express servers, disposable SQLite, synthetic accounts, random JWT secrets and an offline network guard. No owner database, `.env` or live provider was used. This is not a GitHub CI or owner-UAT result.

## Before the fix

Two new HTTP controls failed on the original product validators while compatible inputs still succeeded:

| Input | Observed before | Required |
|---|---|---|
| `offset=1e30` | 500 `INTERNAL` | 400 `VALIDATION_FAILED` |
| `offset=9007199254740992` | 200 | 400 |
| Unsafe URL IDs and owned-category IDs | 404 (not found) | 400 for unsafe magnitude |
| Owned-category object with `toString: null` | 500 | 400 |
| Non-convertible note/icon object or nested array, across unkeyed POST, keyed POST, PATCH and category POST | Eight 500 responses | Eight 400 responses |

Negative, fractional and ordinary invalid query values already returned 400; they remain regression partitions, not new defects. A safe offset of `9007199254740991` returned 200 with an empty page. No invalid write changed the transaction count, existing note or category count; a rejected keyed note did not reserve its key.

## Local fix and compatibility

The shared numeric parsers now require nonnegative/positive `Number.isSafeInteger` values and convert throwing `Number(...)` to field-specific 400. Offset accepts **0–9007199254740991**; limit keeps its existing **0–200** ceiling and defaults. Safe but nonexistent IDs still return ownership-scoped 404. One shared nullable text validator preserves `String(value)` for convertible JSON and changes only a throwing conversion to field-specific 400. It is used by category icon, unkeyed expense, keyed canonical hash/save and expense PATCH. Import's separate stricter note rule was not changed.

Real HTTP positive partitions verified number, both booleans, ordinary object, array, null, omission and normal string. Keyed saves replayed the original snapshot for accepted note values; null and omitted note shared the same canonical payload. Safe numeric/string/array/nested-array category IDs (and `true` when ID 1 exists) replayed under one key with the same response. The accepted coercion policy, hash shape and replay behavior were not changed.

After the fix, both focused HTTP controls passed **2/2**. The full `npm run test:contract` passed **14/14 tests, 335 validated real HTTP responses and 21/21 observed source operations**. `npm run check:openapi` passed **21/21 operations, 298 local references**. OpenAPI descriptions now state the safe bounds and explain that JSON types are accepted only when their value converts without throwing; it does not falsely narrow note/icon to strings.

## Combined local validation status

`npm run test:gates` passed **23/23**; `npm run check` passed **8/8**; `npm run test:db` passed **6/6**; `npm run test:api` passed **274 requests and 945 assertions**; `npm run test:python` passed **27/27**; and `npm run test:import` passed **11/11**. `npm run eval:ai` passed **116/116 offline fixtures**, with `MODEL_QUALITY=NOT_MEASURED`. The final safe `npm run test:race` completed **120 pairs in each of seven scenarios**: zero violations in the six enforcing scenarios; the seventh measured **120/120 duplicate rows for unkeyed ordinary requests**, not an idempotency pass.

The full `npm run test:ai` **failed (exit 1)** at the W9 evaluator rate-window assertion. A single follow-up diagnostic in a **disposable copy**, not the original W9 checkout setup, recorded three evaluator exits of 2, zero provider requests, zero reservations and zero rate-limit refusals. Its cause is **not established**; it neither proves the same root cause as W9 nor shows that the failure is independent of this slice. No AI/evaluator source was edited and no retry-until-green was done. Browser suites were not rerun for this no-UI change. This is not a full-tree pass or a green CI result.

This slice does not address offset-pagination consistency under concurrent inserts, the date domain, browser UI, other API coercion fields, or full reliability. No commit, push or new GitHub CI run is claimed.

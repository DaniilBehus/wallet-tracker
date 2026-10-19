# Four-digit calendar dates — local QA evidence, 2026-10-10

[← Back to README](../../README.md#qa-evidence) · [Run commands](../../docs/testing.md) · [Pure date controls](../dates/date-boundaries.test.js) · [Real HTTP controls](../contract/contract.test.js)

This is **local, uncommitted** evidence on disposable fixtures, not a GitHub CI or owner-UAT result. No application database, `.env` or provider was used. The ordinary API date domain remains the proleptic Gregorian years **0000–9999 inclusive**; the separate AI reference-date policy was not changed.

## Before and after

| Boundary | Before repair | After repair |
|---|---|---|
| `clampToMonth(0, 2, 31)` | `0-02-29` | `0000-02-29` |
| `dayAfter('0001-01-31')` | `1-02-01` | `0001-02-01` |
| `nextDue(15, '0001-01-31')` | `1-01-15`, before its input | `0001-02-15` |
| Successor of `9999-12-31` | Five-digit year `10000` | Explicit `RangeError` with `DATE_OUT_OF_RANGE` |
| Schedule POST with next due beyond 9999 | HTTP 201; row inserted | HTTP 400 `VALIDATION_FAILED`; no row inserted |
| Schedule PATCH creating that next due | HTTP 200; row changed | HTTP 400 `VALIDATION_FAILED`; old row unchanged |
| GET with a seeded legacy edge row | HTTP 200 with invalid next due | HTTP 400 `VALIDATION_FAILED`; no invalid date returned |

The pure control failed **2/3 before** the helper repair, then passed **4/4** after the boundary and upper-clock tests were complete. The real HTTP control failed before with exactly five observations: POST 201 instead of 400 and an inserted row; PATCH 200 instead of 400 and a changed row; legacy GET 200 instead of 400. It passed **1/1** after repair. The contract harness used an authenticated synthetic user, loopback Express server and temporary SQLite database; a legacy row was seeded only in that database and removed by the test.

All emitted helper dates now have `YYYY-MM-DD` width. Year-zero leap day, year `0001`, transitions `0099/0100` and `0999/1000`, month-end clamping, ordinary leap years and a valid `9999-12-31` remain covered. `monthBounds` and `parseDate` keep four-digit input; `today()` pads valid years and raises the same range error if a clock reports year 10000. `next_due` remains computed, not stored. Schedule create checks it before insertion; edit checks the effective stored/requested pair before update inside the existing transaction; list maps only this identified range error to the standard 400 response. No date is silently clamped to 9999, no `null` or new output field is introduced, and no existing rows are migrated or deleted.

The full local contract command passed **15/15 tests and 340 validated real HTTP responses** across **21/21 source operations**. `npm run check:openapi` passed **21/21 operations and 298 local references**. The previous 14/335 checkpoint and the older 11/244 matrix remain historical, not renamed as current results.

Other required local commands passed on this combined tree: `test:gates` **23/23**, `check` **8/8**, Newman `test:api` **274 requests / 945 assertions**, `test:db` **6/6**, `test:python` **27/27**, `test:import` **11/11**, and `test:ai` **240 passed / 1 Windows privilege skip / 0 failed**. `eval:ai` scored **116/116 fixture rows**, explicitly `MODEL_QUALITY=NOT_MEASURED`. One final `test:race` run completed **120 pairs in each of seven scenarios**, with zero enforcing violations; ordinary unkeyed duplicate POSTs were observed in **120/120** measured-only pairs. None of these results is a remote CI run.

This repair does not redefine the AI feature's narrower reference-date policy. A simulated server clock at the last supported day was checked in the pure helper, but non-schedule callers that independently require a nonexistent tomorrow (for example the AI draft date window) were not changed under this scope; their HTTP behavior at that far-future clock was not measured. Browser suites and remote CI were not run for this no-UI slice.

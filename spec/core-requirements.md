**English** · [Slovenčina](../locales/sk/spec/core-requirements.md)

# Core requirements — traceability index

This document links currently public product rules to stable identifiers.
It does not reconstruct private decision records or record owner UAT.

The [architecture](architecture.md) states the broad product decisions;
the [OpenAPI contract](openapi.json) records exact current request/response
behavior. An OpenAPI-only boundary below is labelled **observed contract**,
not an independently approved business requirement. Feature-specific
[monthly](../qa/docs/analysis-monthly-limit.md),
[category](../qa/docs/analysis-category-limits.md),
[AI](ai-expense-entry.md) and
[contract-check](../docs/api/README.md#requirements-for-the-contract-checks)
IDs remain in their own sources. These links describe *what to check*, not
proof that a case ran or that an owner accepted its result.

## Current core rules

### <a id="req-core-01"></a>REQ-CORE-01 · Health

An unauthenticated `GET /api/health` responds with service/database status
without reading user data. Source: [architecture §4](architecture.md#4-api-design)
and the [observed OpenAPI operation](openapi.json). Its `db` field, not just
HTTP 200, indicates database probe health.

### <a id="req-core-02"></a>REQ-CORE-02 · Account and token

Registration creates an account and login issues a signed JWT; protected
routes require a valid Bearer token. A wrong or unknown password/account
does not reveal which account exists. Sources: [architecture §§3–4](architecture.md#3-data-model-and-invariants)
and [observed OpenAPI auth operations](openapi.json).

### <a id="req-core-03"></a>REQ-CORE-03 · Password boundary

The current registration contract requires a password of at least eight
UTF-16 code units and at most 72 UTF-8 bytes, so bcrypt never silently
ignores a suffix.
**Observed contract**, not a recovered private decision: [OpenAPI register](openapi.json)
and [BUG-017](../log/BUGS.md).

### <a id="req-core-04"></a>REQ-CORE-04 · Per-user ownership

Categories, expenses, schedules and settings belong to the authenticated
account. A missing or foreign resource returns the same 404 where a resource
lookup is involved, without disclosing another account's data. Sources:
[architecture §§3–4](architecture.md#3-data-model-and-invariants) and
[observed OpenAPI operations](openapi.json).

### <a id="req-core-05"></a>REQ-CORE-05 · Categories

An account has its own categories; names are unique for that account. Current
registration seeds starter categories. The 60-character name boundary and
error details are **observed contract**. Sources:
[architecture §3](architecture.md#3-data-model-and-invariants) and
[OpenAPI categories](openapi.json).

### <a id="req-core-06"></a>REQ-CORE-06 · Expense amount and save

An expense records a positive integer number of cents; invalid, fractional,
missing or above-ceiling amounts are refused rather than coerced. The exact
100,000,000-cent ceiling is **observed contract**. Sources:
[architecture §§2–3](architecture.md#3-data-model-and-invariants) and
[OpenAPI transaction create](openapi.json).

### <a id="req-core-07"></a>REQ-CORE-07 · Calendar dates

Expense/schedule dates use real local `YYYY-MM-DD` calendar dates, not UTC
date conversion. Expense `spent_on` may be no later than the server-local
day after today; a schedule `starts_on` has no relative past/future bound.
Those distinct validation boundaries are **observed contract**. Sources:
[architecture §2](architecture.md#2-architecture),
[OpenAPI dates](openapi.json), and [date validation](../src/dates.js).

### <a id="req-core-08"></a>REQ-CORE-08 · Transaction list and paging

The account can list/filter its own expenses by date/category; the current
list is ordered and paged rather than silently capped at 200 rows.
Default month, `limit` 0–200 and safe offset are **observed contract**.
Opt-in cursor paging uses the same order and filters to continue without
offset drift after earlier inserts/deletes; its live-count refresh and
non-snapshot limits are specified in the
[pagination consistency analysis](../qa/docs/analysis-pagination-consistency.md).
Sources: [architecture §4](architecture.md#4-api-design),
[OpenAPI list](openapi.json) and [current pagination code](../src/routes/transactions.js).

### <a id="req-core-09"></a>REQ-CORE-09 · Expense edit and delete

`PATCH` changes only supplied client-owned fields; an empty or server-owned
update is refused. Deletion removes the owner's expense; missing/foreign
rows are unavailable. Sources: [architecture §4](architecture.md#4-api-design)
and [OpenAPI transaction operations](openapi.json).

### <a id="req-core-10"></a>REQ-CORE-10 · Keyed versus deliberate saves

One valid account-scoped `Idempotency-Key` and the same canonical payload
replay the original successful create; conflicting payloads or a deleted
original return 409. Unkeyed or deliberately distinct saves do not promise
deduplication. Sources: [architecture §4](architecture.md#4-api-design),
[OpenAPI transaction create](openapi.json), and
[LIMIT-002](../log/BUGS.md).

The ordinary Add screen persists an account-scoped operation key and frozen
amount/category/note/date before dispatch. A lost answer is **uncertain**, not
an invitation to create another expense. Only an explicit Check/retry resends
the same key and body; a deliberate next Save gets a new key. Unreadable local
recovery storage blocks another financial write rather than falling back to an
unkeyed request. [Recovery contract](../qa/docs/analysis-write-recovery.md).

### <a id="req-core-11"></a>REQ-CORE-11 · Schedules and loans

A subscription has no total count; a loan has a finite count. Amount/day/count
must be valid, and remaining values are computed on read rather than stored.
The current 1,200-instalment and money ceilings are **observed contract**,
also guarded by [BUG-018](../log/BUGS.md). Sources:
[architecture §3](architecture.md#3-data-model-and-invariants) and
[OpenAPI schedules](openapi.json).

### <a id="req-core-12"></a>REQ-CORE-12 · Due-date clamping

A schedule due on a missing day of a month falls on that month's last day;
the 31st reaches February 28 or 29. Source:
[architecture §3](architecture.md#3-data-model-and-invariants).

### <a id="req-core-13"></a>REQ-CORE-13 · Payment lifecycle

Paying an active schedule creates one linked expense and advances its paid
count. A loan becomes inactive at its total count; another payment is 409.
Sources: [architecture §§3–4](architecture.md#3-data-model-and-invariants)
and [OpenAPI schedule operations](openapi.json).

An opted-in keyed Pay freezes the displayed schedule preconditions and date;
the server atomically records its key with the linked expense. The same key
and payload replay the original result, including after the final instalment;
a new key against a stale or closed schedule is refused. Unkeyed Pay retains
its previous contract. A lost browser answer is uncertain until the person
explicitly checks/retries. [Recovery contract](../qa/docs/analysis-write-recovery.md).

### <a id="req-core-14"></a>REQ-CORE-14 · Income settings

The account has one current monthly-income setting. A fresh account reads
`monthly_income_cents: 0`, including before any settings row exists; income
cannot be set to null. The optional `monthly_limit_cents`, not income, is
nullable. Replacing income does not change another account's setting.
Exact type/ceiling behavior is **observed contract**. Sources:
[architecture §3](architecture.md#3-data-model-and-invariants) and
[OpenAPI settings](openapi.json).

### <a id="req-core-15"></a>REQ-CORE-15 · Month summary

The summary calculates spent cents, category shares and remaining income
from the account's records; display formatting happens in the browser.
Sources: [architecture §§2, 4–5](architecture.md#4-api-design) and
[OpenAPI summary](openapi.json). Overall/category limit states are specified
separately by REQ-ML and REQ-CL.

### <a id="req-core-16"></a>REQ-CORE-16 · API errors

API errors use the nested `{error:{code,message}}` shape; malformed JSON,
invalid input, missing auth/resource, state conflict and failed-login throttle
have distinct 400/401/404/409/429 outcomes. Oversized JSON is 413.
Sources: [architecture §4](architecture.md#4-api-design) and
[OpenAPI responses](openapi.json).

### <a id="req-core-17"></a>REQ-CORE-17 · Failed-login throttle

Repeated failed sign-ins are throttled before password hashing without
turning a wrong account into an existence oracle. Window/counter details are
**observed contract**. Sources: [architecture §4](architecture.md#4-api-design),
[OpenAPI login](openapi.json), and [BUG-004](../log/BUGS.md).

### <a id="req-core-18"></a>REQ-CORE-18 · Add flow

The phone-first Add screen offers a numeric keypad, category choice, optional
note and explicit Save. A missing amount is not silently saved.
An unresolved Save or Pay is shown as an account-specific recovery action;
the interface never silently retries it or claims it was not saved.
Source: [architecture §5](architecture.md#5-interface-and-interaction-design).

### <a id="req-core-19"></a>REQ-CORE-19 · Month flow

This month presents coherent totals, categories and day-grouped expenses,
with in-place edit and delete. A note may title its row, otherwise the
category does. A fresh account invites income setup instead of inventing
a remainder; cancelling an editor leaves the stored value unchanged.
These income-prompt, note, cancel and donut details are **observed interface**.
Sources: [architecture §5](architecture.md#5-interface-and-interaction-design)
and [current interface](../public/).

### <a id="req-core-20"></a>REQ-CORE-20 · Upcoming flow

Upcoming lists active schedules by next charge date and offers Pay, with
visible loan progress. Pay freezes the row shown at the moment of the action;
a changed row is a conflict rather than an inferred additional payment. Source:
[architecture §5](architecture.md#5-interface-and-interaction-design).

### <a id="req-core-21"></a>REQ-CORE-21 · Schedule form

The Schedules screen creates recurring charges and explicitly chosen loans;
the loan choice reveals an instalment count. An owned row can be edited through
the existing schedule PATCH API without creating another schedule or changing
past payments. The edit UI preserves stored values and treats an unknown write
result as uncertain. Sources: [architecture §5](architecture.md#5-interface-and-interaction-design)
and [schedule-edit UI contract](../qa/docs/analysis-schedule-editing.md).

### <a id="req-core-22"></a>REQ-CORE-22 · Accessible interaction

Interactive/asserted elements have stable `data-testid` and usable roles,
while the interface remains keyboard-accessible and phone-first. The displayed
language is English and money is rendered as euros. Sources:
[architecture §5](architecture.md#5-interface-and-interaction-design)
and [public test design](../qa/docs/test-design.md).

### <a id="req-core-23"></a>REQ-CORE-23 · Untrusted display text

Expense notes and schedule names are rendered as text, not executable markup.
This is an **observed security regression contract**, not an approval inferred
from an old session label. Sources: [current interface](../public/) and
[security browser cases](../qa/e2e/security.spec.js).

### <a id="req-core-24"></a>REQ-CORE-24 · Request diagnostics

Current responses carry a request ID, while ordinary logs omit credentials,
expense descriptions and other sensitive content. This is an **observed
support contract**, not production-support experience. Source:
[support pack](../docs/support/README.md).

### <a id="req-core-25"></a>REQ-CORE-25 · Read-only support diagnostics

The public support pack's parameterised SQL examples are read-only and
explain current month, limit, payment, key and quota state without modifying
data. This is an **observed support exercise**. Source:
[SQL diagnostics](../docs/support/sql-diagnostics.md).

### <a id="req-core-26"></a>REQ-CORE-26 · Visible limit status

Limit state remains textual as well as visual. The current accepted UAT
observation uses an outline when budget remains and white-on-solid-red for
used-up states, while reached and exceeded remain distinct words. Source:
[UAT-OBS-01](../qa/docs/uat-monthly-limit.md#uat-obs-01--the-over-limit-state-is-marked-too-weakly)
and [monthly REQ-ML-09](../qa/docs/analysis-monthly-limit.md#req-ml-09).

### <a id="req-core-27"></a>REQ-CORE-27 · Submission intent

The current browser prevents two near-simultaneous taps on one Save intent
from submitting twice. A completed second user action remains a new
unkeyed expense; this is not universal POST idempotency. Source:
[LIMIT-002](../log/BUGS.md) and
[browser regression cases](../qa/docs/test-cases.md#end-to-end--double-submission--qae2edouble-submitspecjs).

### <a id="req-core-28"></a>REQ-CORE-28 · Additive settings migration

An existing database acquires the nullable monthly-limit column without
losing stored income; repeated startup is safe and fresh/upgraded schemas
agree. This is an **observed migration contract**, not a reconstructed
business decision. Sources: [current migration](../src/db.js) and
[migration cases](../qa/db/migration.test.js).

## Legacy reference migration index

The legacy `§` numbers below referred to an older architecture layout.
The current architecture has §§1–7 only; a matching number does **not**
establish matching meaning. D labels record historical decisions, but the
complete private decision index and original approval/rationale are not
publicly available. All D-row rationales/approval below are **UNKNOWN**;
this table is a navigation aid, not reconstructed history.

| Legacy label | Current public meaning or status |
|---|---|
| old §3 integer/ownership | [architecture §3](architecture.md#3-data-model-and-invariants), REQ-CORE-04/06 |
| old §4.1 dates/clamping | REQ-CORE-07/12 |
| old §4.2 schedule countdown/pay | REQ-CORE-11/13 |
| old §4.3 validation/ownership | REQ-CORE-03/04/06/07/11/14/16; choose by case meaning |
| old §5 API/status | [architecture §4](architecture.md#4-api-design), REQ-CORE-01/02/05/08–10/14–17 |
| old §6, §6.1–§6.4 interface | [architecture §5](architecture.md#5-interface-and-interaction-design), REQ-CORE-18–22 |
| old §6.5 test IDs | [architecture §5](architecture.md#5-interface-and-interaction-design), REQ-CORE-22 |
| old §8/§9 | retired clause numbers; inspect each case's actual current feature/limit source |
| D-011 / D-012 | REQ-CORE-12 / REQ-CORE-22 |
| D-016 / D-024 | REQ-CORE-17; load observation remains [BUG-004](../log/BUGS.md) or [LIMIT-001](../log/BUGS.md) |
| D-017 | port/environment note only; [test setup](../docs/testing.md), **not** a product requirement |
| D-018 / D-019 / D-020 | REQ-CORE-22 / REQ-CORE-22 / REQ-CORE-19 |
| D-021 / D-022 | REQ-CORE-14–15 / REQ-CORE-19 |
| D-029 / D-030 / D-031 | REQ-CORE-09 / REQ-CORE-27 / REQ-CORE-08 |
| D-032 | [test-design method](../qa/docs/test-design.md), **not** a product requirement |
| D-035 | REQ-CORE-10; exact replay/conflict behavior is [observed OpenAPI](openapi.json) |
| D-045 / D-046 | REQ-CORE-03 / REQ-CORE-11; defect evidence [BUG-017/018](../log/BUGS.md) |

The [synthetic-import analysis](../qa/docs/analysis-synthetic-import.md)
is explicitly provisional; its PRE/VAL/AT/ID/ISO/UI labels are **not**
accepted REQ IDs. Executable `TC-CONTRACT-IMPORT` remains outside the
280-row main catalogue. Full executable-case reconciliation belongs to F19.


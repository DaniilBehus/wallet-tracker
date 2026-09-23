# Monthly spending limit — requirements and test analysis

A worked example of the analysis that comes *before* code: goal, scope,
requirements with ids, a decision table, boundaries, state transitions, risks,
a traceability matrix, and a change-impact note. Everything below was written
first; the implementation and the tests follow from it, and every requirement
ends in a test that can be run.

Feature in one sentence: **a person sets one monthly spending limit, and the
month screen says whether the month is within it, exactly at it, or over it.**

## 1. Business goal, scope and assumptions

**Goal.** Wallet already answers *how much did I spend this month*. It does not
answer *is that too much*. A limit the person sets themselves turns the total
into a judgement they can act on before the month ends.

**In scope**

- One limit per person, in euro cents, for a calendar month.
- Four states: not set · within · reached · exceeded.
- Reading the state through the API and on the *This month* screen.
- Setting, changing and clearing the limit.

**Out of scope** (deliberately, so the feature stays one feature)

- Per-category limits, and limits per schedule or loan.
- Notifications, e-mail, push, or any reminder.
- Blocking or warning dialogs when an expense would exceed the limit.
- A history of past limits, or a different limit per month.
- Forecasting, "at this rate you will spend…", or advice.

**Assumptions** (each one is a decision that could have gone the other way)

| # | Assumption | Why, and what it costs |
|---|---|---|
| A1 | The limit is a **signal, not a control**. Saving an expense always succeeds, even when it exceeds the limit. | Money already left the account; refusing to record it would make the app lie. Cost: the limit cannot be used as a hard budget. |
| A2 | The limit is **one current value**, not a value per month. | A single-user personal app; a per-month history is a bigger feature with its own screens. Cost: changing the limit re-judges every month that is displayed, including past ones. |
| A3 | **Not set** and **zero** are different states. `null` means no limit; `0` means "nothing may be spent this month". | Zero is a meaningful budget (a no-spend month). Cost: the API needs an explicit `null`, so "clear the limit" is not the same request as "set it to 0". |
| A4 | **Equal to the limit is `reached`, not `exceeded`.** | Spending exactly the budget is not overspending. This is the boundary most likely to be got wrong, so it is stated before any code. |
| A5 | The status is computed **on the server, on read**, never stored. | The same rule as the month total and the loan balance: a stored judgement goes stale the moment the next expense is added. |
| A6 | The limit is compared with the **same month total the screen already shows** — expenses only, income ignored. | The limit answers "how much do I spend", which is a different question from "what is left of my income". |

## 2. Requirements and acceptance criteria

| ID | Requirement | Acceptance criteria |
|---|---|---|
| REQ-ML-01 | A person can set a monthly limit in whole cents. | AC-01.1 `PUT /api/settings` with `monthly_limit_cents: 12000` stores 12000 and returns it. · AC-01.2 A later `GET /api/settings` returns the same value for that person only. |
| REQ-ML-02 | A person can clear the limit. | AC-02.1 `PUT` with `monthly_limit_cents: null` clears it. · AC-02.2 `GET` then returns `null`, and the month status is `not_set`. |
| REQ-ML-03 | Omitting the field leaves the limit unchanged. | AC-03.1 `PUT` with only `monthly_income_cents` keeps the stored limit and returns it unchanged. |
| REQ-ML-04 | The month summary reports the limit and the state it produces. | AC-04.1 `GET /api/summary` returns `limit_cents`, `limit_status` and `limit_remaining_cents`. · AC-04.2 `limit_status` is one of `not_set`, `within`, `reached`, `exceeded`. · AC-04.3 `limit_remaining_cents` is `limit_cents − total_cents`, exact to the cent, and negative once exceeded. · AC-04.4 With no limit, `limit_cents` and `limit_remaining_cents` are `null`. |
| REQ-ML-05 | The state follows the decision table in §3 exactly, including zero spending and zero limits. | AC-05.1 Every row of the decision table is asserted by a test. |
| REQ-ML-06 | The limit never changes what is stored or what a save does. | AC-06.1 An expense above the limit is still created with 201. · AC-06.2 The month total, the breakdown and the income figures are the same with and without a limit. |
| REQ-ML-07 | Invalid limits are refused with the app's ordinary error contract. | AC-07.1 Negative, fractional, string, boolean and above-ceiling values return 400 `VALIDATION_FAILED` and change nothing. · AC-07.2 The ceiling is the same 1 000 000 EUR used for amounts and income. |
| REQ-ML-08 | A limit belongs to one account. | AC-08.1 Another account reading `GET /settings` and `GET /summary` sees its own limit, never this one's. · AC-08.2 Without a token both routes answer 401. |
| REQ-ML-09 | The month screen states the limit and the state in words, not only in colour. | AC-09.1 The screen shows the limit, and a status line reading *Within limit / Limit reached / Over limit*. · AC-09.2 With no limit the screen offers to set one and shows no state. · AC-09.3 The over-limit state is marked by text and by a class, so colour is never the only carrier. |
| REQ-ML-10 | The limit can be set and cleared from the screen. | AC-10.1 Typing a figure and saving shows the new limit and the recomputed state without a reload. · AC-10.2 Clearing the field and saving removes the limit. · AC-10.3 An invalid figure shows the existing error style and leaves the stored limit alone. |

## 3. Decision table — limit state

Inputs: whether a limit exists, and the month total against it. `T` = month
total in cents, `L` = limit in cents. All combinations, including zero spending
and a zero limit, are enumerated — that is the point of the table.

| Rule | Limit set? | Comparison | Month total | `limit_status` | `limit_remaining_cents` | Screen |
|---|---|---|---|---|---|---|
| R1 | no | — | `T = 0` | `not_set` | `null` | "Set a limit", no state line |
| R2 | no | — | `T > 0` | `not_set` | `null` | "Set a limit", no state line |
| R3 | yes, `L > 0` | `T < L` | `T = 0` | `within` | `L` | *Within limit · €L left* |
| R4 | yes, `L > 0` | `T < L` | `0 < T < L` | `within` | `L − T` (> 0) | *Within limit · €… left* |
| R5 | yes, `L > 0` | `T = L` | `T = L` | `reached` | `0` | *Limit reached* |
| R6 | yes, `L > 0` | `T > L` | `T > L` | `exceeded` | `L − T` (< 0) | *Over limit by €…* |
| R7 | yes, `L = 0` | `T = L` | `T = 0` | `reached` | `0` | *Limit reached* |
| R8 | yes, `L = 0` | `T > L` | `T > 0` | `exceeded` | `−T` | *Over limit by €…* |

Two consequences worth naming, because they are what a reviewer checks first:
`T = L` is **`reached`, never `exceeded`** (A4), and a zero limit is a real
limit, so R7 and R8 exist instead of collapsing into R1.

## 4. Boundary values, state transitions, negative cases and risks

**Boundaries** (cents; the ceiling is 100 000 000 = 1 000 000 EUR)

| Value under test | Expected |
|---|---|
| `L − 1`, `L`, `L + 1` as the month total | `within`, `reached`, `exceeded` |
| `L = 0`, `T = 0` | `reached` (R7) |
| `L = 1`, `T = 0` / `T = 1` / `T = 2` | `within` / `reached` / `exceeded` |
| `L = 100000000` | accepted, stored exactly |
| `L = 100000001` | 400, nothing stored |
| `L = −1` | 400 |
| `L = 12.5` (fractional) | 400 |
| `L = "12000"` (string), `true` (boolean) | 400 |
| `L = null` | limit cleared, status `not_set` |
| field omitted | limit unchanged |

**State transitions.** The state is derived, so it changes when either input
changes; there is no state machine to get out of step.

```
                    set limit (L>0, T<L)        add expense (T→L)      add expense (T>L)
   not_set ───────────────────────────► within ─────────────► reached ─────────────► exceeded
      ▲                                   ▲ │                    │                      │
      │ clear limit (null)                │ └─ delete / edit ◄───┘                      │
      └───────────────────────────────────┴──────── delete or edit expense ◄────────────┘
                                          lower the limit ─► reached / exceeded
                                          raise the limit ─► within
```

Also: moving to another month re-evaluates the same limit against that month's
total (A2), and an expense whose category was deleted still counts, because the
month total already counts it.

**Negative and abuse cases**

| Case | Expected |
|---|---|
| No token on `GET /settings`, `PUT /settings`, `GET /summary` | 401, no data |
| Another account's limit | invisible; each account reads its own |
| Limit set while a request for another month is in flight | the response states the month it describes; the client renders the month it asked for |
| Expense above the limit | still saved (A1); only the status changes |
| Malformed JSON body | 400 `VALIDATION_FAILED`, never 500 |

**Risks**

| ID | Risk | Mitigation |
|---|---|---|
| RISK-ML-1 | The equality boundary is implemented as `>=` and "reached" disappears. | A4 stated up front; R5/R7 in the table; boundary tests at `L−1`, `L`, `L+1`. |
| RISK-ML-2 | Money handled as a float, so 12000 vs 119.999… | Integer cents end to end; the `check.js` no-float gate covers `src/`. |
| RISK-ML-3 | The status is computed twice — server and browser — and the two drift. | The server computes it; the browser only renders what it is given. |
| RISK-ML-4 | `null` (no limit) is coerced to `0`, so "no limit" silently becomes "no spending allowed". | A3; explicit `null` handling with its own tests (R1/R2 vs R7/R8). |
| RISK-ML-5 | The new field breaks existing settings and summary consumers. | Additive fields only; the existing settings and summary cases stay unchanged and must still pass. |
| RISK-ML-6 | Colour alone communicates "over limit" (accessibility). | AC-09.3: text first, class second. |

## 5. Traceability

Requirement → test condition → case id → the automated test that runs it. The
result column is filled from the recorded run in
[`test-report-monthly-limit.md`](test-report-monthly-limit.md).

| Requirement | Test condition | Case | Automated test | Result |
|---|---|---|---|---|
| REQ-ML-01 | A stored limit is returned unchanged | TC-API-091 | `qa/api/wallet.postman_collection.json` · 12 | PASS |
| REQ-ML-02 | `null` clears the limit | TC-API-092 | same, 12 | PASS |
| REQ-ML-03 | An omitted field leaves the limit alone | TC-API-093 | same, 12 | PASS |
| REQ-ML-04 | Summary carries limit, status and remaining | TC-API-094 | same, 12 | PASS |
| REQ-ML-05 | R1–R2 no limit, with and without spending | TC-API-095 | same, 12 | PASS |
| REQ-ML-05 | R3–R4 within, including zero spending | TC-API-096 | same, 12 | PASS |
| REQ-ML-05 | R5 exactly at the limit | TC-API-097 | same, 12 | PASS |
| REQ-ML-05 | R6 over the limit, remaining negative | TC-API-098 | same, 12 | PASS |
| REQ-ML-05 | R7–R8 a zero limit | TC-API-099 | same, 12 | PASS |
| REQ-ML-05 | Boundary: the smallest limit above zero (`L = 1`, `T = 0`) | TC-API-100 | same, 12 | PASS |
| REQ-ML-06 | An expense above the limit is still created | TC-API-101 | same, 12 | PASS |
| REQ-ML-07 | Negative, fractional, string, boolean, ceiling+1 | TC-API-102 | same, 12 | PASS |
| REQ-ML-07 | The ceiling exactly is accepted | TC-API-103 | same, 12 | PASS |
| REQ-ML-08 | Another account sees its own limit | TC-API-104 | same, 12 | PASS |
| REQ-ML-08 | No token → 401 | TC-API-105 | same, 12 | PASS |
| REQ-ML-09 | The screen shows limit and state in words | TC-E2E-065 | `qa/e2e/month.spec.js` | PASS |
| REQ-ML-09 | Over limit is marked by text and class | TC-E2E-066 | `qa/e2e/month.spec.js` | PASS |
| REQ-ML-10 | Setting from the screen updates the state live | TC-E2E-067 | `qa/e2e/month.spec.js` | PASS |
| REQ-ML-10 | Clearing from the screen removes the limit | TC-E2E-068 | `qa/e2e/month.spec.js` | PASS |
| REQ-ML-10 | An invalid figure is refused without changing the stored limit | TC-E2E-069 | `qa/e2e/month.spec.js` | PASS |

## 6. Change-impact analysis

| Area | Change | Risk to what exists |
|---|---|---|
| Database | `settings.monthly_limit_cents`, nullable, added by a guarded `ALTER TABLE` on boot; existing rows keep `NULL` = no limit | Additive; an older database upgrades in place on the next start |
| API `GET /api/settings` | new field `monthly_limit_cents` | Additive; existing assertions read `monthly_income_cents` and still pass |
| API `PUT /api/settings` | optional field; `null` clears, omission keeps | The income contract is untouched, including its 400s |
| API `GET /api/summary` | new fields `limit_cents`, `limit_status`, `limit_remaining_cents` | Additive; `total_cents`, `income_cents`, `remaining_cents` and `by_category` unchanged |
| Server | `limitStatus()` in `src/settings.js`; the summary route calls it | One place computes the judgement |
| Screen *This month* | limit row, editor and status line; new test ids `limit-value`, `limit-edit`, `limit-input`, `limit-save`, `limit-cancel`, `limit-status` | Income, donut, bars and the expense list are untouched |
| Page object | `qa/e2e/pages/month.page.js` gains the same ids | Required by the coverage gate: every test id in `public/` is addressed from a page object |
| Tests | new Postman folder 12, new cases in `qa/e2e/month.spec.js`, new rows in `qa/docs/test-cases.md` | Existing cases are unchanged and must stay green |
| Gates | `check.js` C3 (ids), C6 (routes covered), C7 (ids in page objects), C8 (statuses asserted) | No new route and no new status code, so C6 and C8 keep their counts |
| Not touched | AI expense entry, schedules, loans, categories, auth, rate limiting, load and race layers | — |

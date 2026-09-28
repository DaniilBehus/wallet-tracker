# Category spending limits — requirements and test analysis

[← Back to README](../../README.md#qa-evidence) · [The monthly limit this extends](analysis-monthly-limit.md) · [Next: test cases →](test-cases.md)

The analysis for Wallet's second budgeting feature, written before any code and
in the same shape as the [monthly limit analysis](analysis-monthly-limit.md):
goal and scope, the business rules with what each one costs, requirements as
user stories with Given/When/Then acceptance criteria, a decision table,
boundaries, state transitions, negative cases, risks, traceability and a
change-impact note.

Feature in one sentence: **a person gives a category its own monthly limit, and
the month breakdown says, for that category, whether budget is left, the limit
is exactly used, or it is over.**

**Who decided what.** The owner chose this feature and its scope and, on
2026-09-27, accepted the recommended business rules CL-D1…CL-D12 below as they
stand; the owner did not write them. The analysis was drafted with an AI agent
(Claude) from those rules and the code as it was before the feature.

**Specification before code.** Sections 1–4 and 6, with the matching sections of the
[architecture notes](../../spec/architecture.md) and the
[analysis models](../../docs/analysis/README.md), are the specification the
implementation has to meet. The analysis and architecture were committed on
2026-09-27; the models were still incomplete then. The completed models and this
clarification are frozen together in the separate specification commit on
2026-09-28, before category-limit production code. Later changes require a dated
entry in [§7](#7-change-notes), with the reason. §5 remains unfilled until the
implementation's actual recorded run; the feature is not implemented yet.

## 1. Business goal, scope and assumptions

**Goal.** The monthly limit answers *is this month too much*. It cannot say
*where*: €800 against an €800 limit can be an ordinary month, or a month in
which restaurants took twice what was planned. A limit on a category puts the
judgement where the spending decision is made.

**In scope**

- One optional limit per category, in euro cents, for a calendar month; one current value.
- The monthly limit's four states, per category: not set · within · reached · exceeded.
- Setting, changing and clearing a category's limit through the API and from the month breakdown.
- Reading every category's state through `GET /api/summary` and in the breakdown on *This month*.
- Paid schedule instalments counting toward their category.

**Out of scope** (so the feature stays one feature)

- A history of limits, or a different limit for each month.
- Notifications, warnings, or blocking before a save.
- Editing category names or icons; deleting categories.
- Limits per schedule or loan; a limit on Uncategorised.
- Any check or warning about how category limits add up — against each other or against the overall limit.
- Forecasting: a planned instalment counts once it is paid, not before.

**Assumptions** — the business rules, decided; each one could have gone the other way

| # | Rule | Why, and what it costs |
|---|---|---|
| CL-D1 | Category limits are **independent** of the overall monthly limit. No check or warning about their sum. | The overall limit asks "how much in total", a category limit "how much here". People plan some categories and leave others open, so a sum rule would refuse ordinary budgets and tie two settings together. Cost: the app never mentions that €300 + €300 of category limits sit under a €400 overall limit; both categories can read *within* while the month is over. |
| CL-D2 | **Signal, not control.** Saving an expense always succeeds, even when it takes a category over its limit. | As A1 of the monthly limit: the money has already left, and refusing to record it would make the app lie. Cost: a category limit informs; it cannot enforce. |
| CL-D3 | **Uncategorised** falls under no category limit and cannot be given one. Its expenses still count toward the month total and the overall limit. | Uncategorised is the absence of a decision, not a budget line: judging it would invent a budget nobody set, and a limit on it would reward leaving expenses unassigned. It has no category id, so there is nowhere to store one. Cost: spending without a category escapes every category limit; its row shows an amount and no state. |
| CL-D4 | **Paid** scheduled payments with a category count toward that category, exactly as they count toward the month total; **unpaid** future instalments do not. | Paying an instalment writes an ordinary expense with the schedule's category, dated the day it was paid — the record the month total already counts. Counting planned instalments would judge money that has not left and make a category disagree with the month. Cost: a category can read *within* early in the month although a known subscription will take it over later; there is no forecast. |
| CL-D5 | One **current** value per category, not one per month. | As A2: a single-user app, and a per-month history is a bigger feature with screens of its own. Cost: changing a limit re-judges every month the summary is asked for, past ones included. |
| CL-D6 | `null` means no limit; `0` is a real zero limit; omitting the field leaves the limit unchanged. | As A3: zero is a meaningful budget ("no restaurants this month"). Cost: clearing needs an explicit `null`. The limit is the only field a category update takes, so a body that omits it asks for no change at all — which every `PATCH` in the app refuses with `400` (D-029, `patchFields` in `src/validate.js`). Either way the stored limit stays as it was. |
| CL-D7 | Equality is **reached**, not exceeded. On screen, used up (reached or over) is the owner's accepted **solid red box with white text**; budget left is a **white outline**; no limit shows nothing. | As A4, in the box language the owner accepted for the overall limit at UAT (UAT-OBS-01): the box answers "is any budget left", the words keep *reached* and *over* apart. Cost: reached and over share one box, so only the words tell them apart; and in the fallback palette without `theme.css` the breakdown card is light, where a white outline cannot be seen (RISK-CL-13). |
| CL-D8 | Computed on the server **on read**, never stored, from the category's month total of expenses; income is ignored. The judgement is `limitState` from `src/settings.js`. | As A5 and A6: a stored state goes stale with the next expense, and one function judging both limits means equality and zero cannot be handled differently in two places. Cost: each summary read aggregates once more — trivial at this scale. |
| CL-D9 | A limit belongs to one account. Another account's category id is answered exactly as a missing one, `404 NOT_FOUND`. Validation is the monthly limit's: integer cents from 0 up to the same 1 000 000 EUR ceiling, `null` clears, anything else is `400 VALIDATION_FAILED` and nothing changes. | As the rest of the API (architecture §4): `403` would confirm that the row exists and invite enumeration, and one validator for both limits accepts exactly the same numbers. Cost: a mistyped id and a probe of another account get the same answer — by design. |
| CL-D10 | A category **with a limit** is listed in the month breakdown even when nothing was spent in it (`€0.00 of €200.00`); a category with neither a limit nor spending stays hidden, as today. | A budget that only appears once money is spent is a poor plan; seeing it from the first day is the point of setting it, and hiding empty categories keeps the breakdown short. Cost: `by_category` is no longer "the categories with spending", so whatever assumed money in every row — the donut, the share of the month — has to handle a zero row. And a category with neither a limit nor spending this month has no row to tap: its first limit is set after its first expense, or through the API. |
| CL-D11 | `PATCH /api/categories/:id` takes `{"monthly_limit_cents": …}` — an integer or `null` — and nothing else: renaming and deleting categories stay out of scope. `GET /api/categories` returns the limit. `GET /api/summary` adds `limit_cents`, `limit_status` and `limit_remaining_cents` to every `by_category` row. On screen, tapping a category row in the breakdown opens a small editor that sets or clears its limit. | `PATCH` is the app's verb for a partial change, and one field keeps the feature one feature. The editor lives where the state is shown, in the sheet the expense editor already uses. Cost: no screen lists every category; CL-D10 names the category that has no row. |
| CL-D12 | Stored as a nullable `categories.monthly_limit_cents INTEGER CHECK (monthly_limit_cents IS NULL OR monthly_limit_cents >= 0)`, added to existing databases by the additive migration pattern in `src/db.js` (as `settings.monthly_limit_cents`) and covered by `test:db`. | Nullable, so every existing category reads "no limit" after the upgrade; the `CHECK` keeps a negative limit out even if a validator is bypassed; a guarded `ALTER TABLE`, because `CREATE TABLE IF NOT EXISTS` never adds a column to a table that already exists. Cost: one more boot step, on an upgrade path that only its own test ever exercises. |

## 2. Requirements and acceptance criteria

One persona throughout — *a person who budgets by category*. `L` is a category's
limit and `T` that category's total of expenses for the month, both in cents.
Every criterion is written as Given / When / Then and ends in at least one test
(§5).

### REQ-CL-01 · Set a category limit

*As a person who budgets by category, I want to give one category a monthly
limit, so that I can see whether that part of my spending stays within what I
planned.*

| AC | Given | When | Then |
|---|---|---|---|
| AC-01.1 | one of my categories has no limit | I send `PATCH /api/categories/:id` with `{"monthly_limit_cents": 20000}` | the answer is `200` with the category and `monthly_limit_cents: 20000`, and `GET /api/categories` returns 20000 for it |
| AC-01.2 | the category's limit is 20000 | I send 15000 | 15000 replaces it: there is one current value (CL-D5) |
| AC-01.3 | the category has no limit | I send `0` | `0` is stored and returned as `0`, not `null` — a real zero limit (CL-D6) |

### REQ-CL-02 · Clear a category limit

*As a person who budgets by category, I want to remove a category's limit, so
that a category I no longer plan for stops being judged.*

| AC | Given | When | Then |
|---|---|---|---|
| AC-02.1 | the category has a limit and spending this month | I send `{"monthly_limit_cents": null}` | `200` with `null`; `GET /api/categories` returns `null`; its summary row reads `not_set`, with `null` limit and remaining |
| AC-02.2 | the category has a limit and nothing spent this month | I clear the limit | the category leaves `by_category`: no limit and no spending is hidden, as before (CL-D10) |

### REQ-CL-03 · A request without a limit leaves it alone

*As a person who budgets by category, I want a request that gives no limit to
leave the stored one alone, so that nothing I send by accident wipes a limit I
set.*

| AC | Given | When | Then |
|---|---|---|---|
| AC-03.1 | the category's limit is 20000 | I send `PATCH` with `{}`, the field omitted | `400 VALIDATION_FAILED`, the app's answer to an empty change (CL-D6); the limit is still 20000 |
| AC-03.2 | the same | I send only `name` or `icon` | `400 VALIDATION_FAILED` naming the unknown field — renaming is out of scope; nothing changes |
| AC-03.3 | the same | I create a category, or save my income or my overall limit | the category's limit is still 20000 |

### REQ-CL-04 · A mistyped limit is refused

*As a person who budgets by category, I want a mistyped limit to be refused, so
that a wrong figure never becomes my budget.*

| AC | Given | When | Then |
|---|---|---|---|
| AC-04.1 | the category's limit is `L` | I send a negative, fractional, string, boolean or array value, or one above the ceiling | `400 VALIDATION_FAILED`; the limit is still `L` (CL-D9) |
| AC-04.2 | any category of mine | I send exactly `100000000` — 1 000 000 EUR, the ceiling of every amount | it is accepted and returned exactly |
| AC-04.3 | — | the id in the path is not a positive integer (`abc`, `0`, `-1`, `1.5`, `null`) | `400 VALIDATION_FAILED`. Uncategorised has no id, so no request can give it a limit (CL-D3) |

### REQ-CL-05 · My limits are mine alone

*As a person who budgets by category, I want my category limits to belong to my
account alone, so that no other account can read or change them.*

| AC | Given | When | Then |
|---|---|---|---|
| AC-05.1 | account A's category `C` has limit `L` | account B sends `PATCH /api/categories/C` with a valid body | `404 NOT_FOUND` with the message an id that does not exist gets; A's limit is still `L` (CL-D9) |
| AC-05.2 | the same | B reads `GET /api/categories` and `GET /api/summary` | B sees only B's own categories and limits |
| AC-05.3 | no token | a client sends `PATCH /api/categories/:id` | `401`, and nothing changes |

### REQ-CL-06 · The summary judges every category row

*As a person who budgets by category, I want the month summary to give each
category's limit, state and what is left, so that the screen and any other
client read one judgement.*

| AC | Given | When | Then |
|---|---|---|---|
| AC-06.1 | any month | I read `GET /api/summary` | every `by_category` row carries `limit_cents`, `limit_status` and `limit_remaining_cents` beside `category_id`, `name` and `total_cents` |
| AC-06.2 | a row with a limit | I read it | `limit_status` is `within`, `reached` or `exceeded`, and `limit_remaining_cents` is `L − T` to the cent, negative once exceeded |
| AC-06.3 | a row without a limit | I read it | `limit_status` is `not_set`, with `limit_cents` and `limit_remaining_cents` both `null` |
| AC-06.4 | the decision table in §3 | the suites run | each of its rules is asserted by a test |
| AC-06.5 | an overall limit and category limits are both set | I read the summary | its top-level `limit_*` fields describe the overall limit alone, computed exactly as before (CL-D1) |

### REQ-CL-07 · A limited category is listed before anything is spent

*As a person who budgets by category, I want a category with a limit to appear
in the month before I spend in it, so that I can see my whole plan from the
first day.*

| AC | Given | When | Then |
|---|---|---|---|
| AC-07.1 | category `C` has limit 20000 and no expense this month | I read the summary | `C` is in `by_category` with `total_cents: 0`, `limit_status: within` and `limit_remaining_cents: 20000` |
| AC-07.2 | a category has neither a limit nor spending this month | I read the summary | it is not in `by_category`, as before |
| AC-07.3 | rows with and without spending | I read the summary | rows with spending come first, largest total first, as before; limited rows with nothing spent follow in the order the categories were created; the totals still add up to `total_cents` |

### REQ-CL-08 · Only money that was spent counts

*As a person who budgets by category, I want a category's total to count what
was actually paid in it — a paid loan or subscription instalment included — and
nothing that is only planned, so that the state reflects money that has left.*

| AC | Given | When | Then |
|---|---|---|---|
| AC-08.1 | a schedule in category `C` | I pay one instalment this month | `C`'s total and state include it, exactly as the month total does (CL-D4) |
| AC-08.2 | an active schedule in `C` with an instalment not yet paid | I read the summary | neither `C`'s total nor the month total includes it |
| AC-08.3 | a monthly income is set | I read the summary | the income never enters a category's total (CL-D8) |

### REQ-CL-09 · Uncategorised is never judged

*As a person who budgets by category, I want expenses without a category to stay
outside every category limit, so that an expense I did not assign is never
judged against a budget it was not given.*

| AC | Given | When | Then |
|---|---|---|---|
| AC-09.1 | uncategorised expenses this month, and limits on other categories | I read the summary | the Uncategorised row (`category_id: null`) reads `not_set`, with `null` limit and remaining; its expenses still count toward `total_cents` and the overall limit (CL-D3) |
| AC-09.2 | the breakdown shows an Uncategorised row | I look for its editor | there is none: the row is not a control |

### REQ-CL-10 · A limit never blocks, and stands on its own

*As a person who budgets by category, I want saving to work whatever my category
limits say, and each limit to be judged on its own, so that the app records what
happened and does not tie my budgets together.*

| AC | Given | When | Then |
|---|---|---|---|
| AC-10.1 | category `C` is at or over its limit | I save another expense in `C` | it is created with `201`, and nothing warns (CL-D2) |
| AC-10.2 | an overall limit of 40000 | I give two categories limits of 30000 each | both are accepted with `200`, with no warning about their sum (CL-D1) |
| AC-10.3 | an overall limit, an income and a category limit are set | I set or clear the category limit | the overall limit, the income and the month total do not change; saving the income or the overall limit leaves category limits alone |

### REQ-CL-11 · The breakdown shows each limited category against its limit

*As a person who budgets by category, I want each limited category in the month
breakdown to show what I spent of its limit and whether budget is left, so that
I see at a glance where the month went over.*

| AC | Given | When | Then |
|---|---|---|---|
| AC-11.1 | a category with a limit | I open *This month* | its row reads `€T of €L`, for example `€0.00 of €200.00` (CL-D10) |
| AC-11.2 | `T < L` | I open *This month* | a status line *Within limit · €… left* in a white outline box with no fill |
| AC-11.3 | `T = L` | I open *This month* | *Limit reached* in the solid red box with white text: nothing is left, and it is not over (CL-D7) |
| AC-11.4 | `T > L` | I open *This month* | *Over limit by €…* in the solid red box with white text |
| AC-11.5 | a category without a limit | I open *This month* | its row shows the amount as today, with no status line and no box |
| AC-11.6 | any state | I read the row | the words carry the state and the box repeats it, so colour is never the only signal |
| AC-11.7 | a 320 px wide screen, the longest amounts and a long category name | I open *This month* | the row, its amount and its box fit: nothing is clipped and the page does not scroll sideways |

### REQ-CL-12 · Set or clear a limit from the breakdown

*As a person who budgets by category, I want to tap a category in the month
breakdown and set or clear its limit there, so that I change a budget where I
see it.*

| AC | Given | When | Then |
|---|---|---|---|
| AC-12.1 | a category row | I tap it | an editor opens, named for the category and holding its current limit, empty when there is none |
| AC-12.2 | the editor | I type `60.00` and save | the row shows `of €60.00` and its new state without a reload; the API returns 6000 |
| AC-12.3 | the editor of a category with a limit | I empty the field and save | the limit is removed: the box goes, and the row leaves the breakdown if nothing was spent |
| AC-12.4 | the editor | I type `0` and save | a zero limit is saved, not a clear |
| AC-12.5 | the editor | I type something that is not an amount and save | the app's error message; nothing is sent; the stored limit is unchanged |
| AC-12.6 | the editor | I press Cancel | it closes and nothing is sent |

### REQ-CL-13 · An existing database keeps working

*As the owner of an existing Wallet database, I want the upgrade to add category
limits without touching my data, so that nothing is judged until I set a limit.*

| AC | Given | When | Then |
|---|---|---|---|
| AC-13.1 | a database made before this feature, with categories in it | the server starts | `categories` gains `monthly_limit_cents`; every existing category reads `null`; ids, names and icons are unchanged (CL-D12) |
| AC-13.2 | the upgraded database | the server starts again | nothing changes, and the column is not added twice |
| AC-13.3 | the upgraded database | a negative limit is written straight to SQLite | the `CHECK` refuses it: the database enforces the rule, not only the validator |

## 3. Decision table — category state

Inputs: which row it is (a category, or Uncategorised), whether the category has
a limit, and its month total `T` against the limit `L`. The judgement is
`limitState(L, T)` — the function that judges the overall limit (CL-D8) — so
the two cannot disagree about equality or zero. Every combination is listed,
including the rows that do not appear at all.

### 3.1 The state of one row

| Rule | Row | Limit `L` | Month total `T` | Listed in `by_category`? | `limit_status` | `limit_remaining_cents` | Breakdown row |
|---|---|---|---|---|---|---|---|
| CR1 | Uncategorised | cannot have one | `T > 0` | yes | `not_set` | `null` | amount only; no box; not tappable |
| CR2 | Uncategorised | cannot have one | `T = 0` | no | — | — | — |
| CR3 | category | none (`null`) | `T = 0` | no, as before | — | — | — |
| CR4 | category | none (`null`) | `T > 0` | yes | `not_set` | `null` | amount only; no box |
| CR5 | category | `L > 0` | `T = 0` | **yes** (CL-D10) | `within` | `L` | `€0.00 of €L` · *Within limit · €L left* · white outline |
| CR6 | category | `L > 0` | `0 < T < L` | yes | `within` | `L − T` (> 0) | *Within limit · €… left* · white outline |
| CR7 | category | `L > 0` | `T = L` | yes | `reached` | `0` | *Limit reached* · red box |
| CR8 | category | `L > 0` | `T > L` | yes | `exceeded` | `L − T` (< 0) | *Over limit by €…* · red box |
| CR9 | category | `L = 0` | `T = 0` | **yes** (CL-D10) | `reached` | `0` | `€0.00 of €0.00` · *Limit reached* · red box |
| CR10 | category | `L = 0` | `T > 0` | yes | `exceeded` | `−T` | *Over limit by €…* · red box |

### 3.2 What makes up `T`

| Rule | Money in the category | Counts toward `T`? | Why |
|---|---|---|---|
| CR11 | an expense dated in the month | yes | the month total counts it |
| CR12 | a **paid** instalment of a schedule in the category, paid this month | yes | paying writes an expense with the schedule's category, dated the day of payment, and the month total counts it the same way (CL-D4) |
| CR13 | an **unpaid** instalment, due or still in the future | no | it is not an expense yet, and the month total does not count it either |
| CR14 | an expense in the category dated in another month | no | each month is judged on its own expenses, against the same current limit (CL-D5) |
| CR15 | the monthly income | never | a limit judges spending, not what is left of income (CL-D8) |
| CR16 | an expense moved to another category by an edit | in the category it is in now | the category on the record decides, as the breakdown already does |

Three consequences a reviewer checks first: `T = L` is **reached, never
exceeded** (CR7, CR9); a zero limit is a real limit, so CR9 and CR10 exist
instead of collapsing into CR3 and CR4; and a limit makes a category visible
before anything is spent in it (CR5, CR9), while a category with neither a limit
nor spending stays hidden (CR3).

## 4. Boundary values, state transitions, negative cases and risks

**Boundaries** (cents; the ceiling is 100 000 000 = 1 000 000 EUR, as for every
amount, the income and the monthly limit)

| Value under test | Expected |
|---|---|
| `T = L − 1`, `L`, `L + 1` | `within`, `reached`, `exceeded` |
| `L = 0`, `T = 0` | `reached`, and the row is listed (CR9) |
| `L = 1`, `T = 0` / `1` / `2` | `within` / `reached` / `exceeded` |
| `L = 100000000` | accepted, stored exactly |
| `L = 100000001` | `400`, nothing stored |
| `L = −1`, `12.5`, `"12000"`, `true`, `[]` | `400`, nothing stored |
| `L = null` | limit cleared, `not_set` |
| `{}` — the field omitted | `400`, an empty change; the limit unchanged |
| `{"name": …}` or `{"icon": …}` | `400`, an unknown field; nothing changed |
| path id `abc`, `0`, `-1`, `1.5`, `null` | `400` |
| a path id that does not exist, or another account's | `404`, the same answer for both |

**State transitions.** As with the overall limit, the state is derived from `L`
and `T`, so there is no stored state to fall out of step.

```
                      set L > 0, T < L         T reaches L          T passes L
  hidden or not_set ─────────────────►  within  ──────────►  reached  ──────────►  exceeded
  (no limit)        ◄─────────────────  (T < L) ◄──────────  (T = L)  ◄──────────  (T > L)
                      clear (null)         delete or edit an expense, or raise L
```

- Clearing from any state with a limit gives `not_set` when something was spent
  this month, and hides the row when nothing was.
- Setting `L = 0` gives `reached` with nothing spent and `exceeded` otherwise;
  lowering `L` to `T` or below gives `reached` or `exceeded`.
- Paying an instalment raises `T` like any expense; an unpaid one moves nothing.
- A new month starts every category at `T = 0`: `within` with `L > 0`, `reached`
  with `L = 0`, hidden without a limit.
- Uncategorised has no transitions: whenever it is listed, it is `not_set`.

**Negative and abuse cases**

| Case | Expected |
|---|---|
| No token on `PATCH /api/categories/:id` | `401`, nothing changed |
| Another account's category id | `404 NOT_FOUND`, the answer a missing id gets; the owner's limit unchanged |
| Uncategorised addressed as `null` or `none` | `400`: there is no category to give a limit to |
| A body that renames, changes the icon, or sets `id` or `user_id` | `400`: renaming is out of scope, and server-owned fields are never set by a client |
| Malformed JSON | `400 VALIDATION_FAILED`, never `500` |
| An oversized body | `413`, as on every route |
| An expense that takes a category over its limit | saved; only the state changes (CL-D2) |
| Category limits adding up to more than the overall limit | accepted, with no warning (CL-D1) |

**Risks**

| ID | Risk | Mitigation |
|---|---|---|
| RISK-CL-1 | Equality implemented as `>=`, so *Limit reached* never appears for a category. | `limitState` is reused, not rewritten; CR7 and CR9 are asserted, with boundaries at `L − 1`, `L` and `L + 1`; a negative control that treats equality as over must fail them. |
| RISK-CL-2 | A planned instalment counted, so a category is judged on money that has not left. | CR12 and CR13 asserted with a paid and an unpaid instalment; a negative control that counts the unpaid one must fail. |
| RISK-CL-3 | Uncategorised judged — a join that matches a limit to a `NULL` category, or an editor offered on its row. | CR1 asserted at the API and on the screen; a negative control that judges Uncategorised must fail. |
| RISK-CL-4 | Another account's category editable — an update without the owner in its condition. | AC-05.1 with a second account; a negative control that drops the ownership check must fail. |
| RISK-CL-5 | `null` coerced to `0`, or a request without the field wiping the limit. | CL-D6; `null` against `0`, and `{}`, each have a case of their own. |
| RISK-CL-6 | An existing database cannot be opened, or its categories come back with limits nobody set. | CL-D12; a `test:db` case builds the old table and upgrades it (REQ-CL-13). |
| RISK-CL-7 | Code that assumed money in every breakdown row breaks on a zero row: a share divided by a zero month total, an empty donut arc, the breakdown hidden in a month with no spending. | The donut draws only rows with spending; a zero row shows an empty bar; end-to-end cases for a zero-spend row and for a month with no spending at all. |
| RISK-CL-8 | Server and browser judge separately and drift apart. | The server returns the state and the browser renders it (as RISK-ML-3). |
| RISK-CL-9 | Colour alone carries the state. | Words in every state; the box repeats them (AC-11.6). |
| RISK-CL-10 | The row, its amount and its box do not fit a small phone. | AC-11.7: a 320 px case with the longest amounts and a long name. |
| RISK-CL-11 | The overall limit and category limits tied together — a sum check, or one changing the other. | CL-D1; AC-06.5, AC-10.2 and AC-10.3 each have a case. |
| RISK-CL-12 | The contract tests reject the new fields: the collection's schemas refuse unknown properties. | Deliberate: the `category` schema and the `by_category` row schema gain the fields in the same change, so an unplanned field still fails. |
| RISK-CL-13 | In the fallback palette — `style.css` without `theme.css` — the breakdown card is light, and a white outline cannot be seen on it. | Accepted: the app always loads `theme.css`, where the card is dark; the words carry the state in both palettes. Contrast is asserted in the product palette. |

## 5. Traceability

Requirement → test condition → case id → the automated test that runs it →
result. Filled in from the implementation's recorded run (Stage B2), reported in
`test-report-category-limits.md`; until then the layer is the plan and the case
and result columns are empty.

| Requirement | Test condition | Layer | Case | Result |
|---|---|---|---|---|
| REQ-CL-01 | A number is stored and returned; a second one replaces it | API | — | — |
| REQ-CL-01, REQ-CL-02 | `0` is a real limit, and `null` clears it | API | — | — |
| REQ-CL-03 | `{}` and an unknown field change nothing | API | — | — |
| REQ-CL-04 | Negative, fractional, string, boolean, array and ceiling + 1 are refused | API | — | — |
| REQ-CL-04 | The ceiling exactly is accepted | API | — | — |
| REQ-CL-04 | A path id that is not a positive integer | API | — | — |
| REQ-CL-05 | Another account's category answers `404` and stays unchanged | API | — | — |
| REQ-CL-05 | No token → `401` | API | — | — |
| REQ-CL-06, REQ-CL-07 | CR3–CR6: no limit, and within with and without spending | API | — | — |
| REQ-CL-06 | CR7: exactly at the limit | API | — | — |
| REQ-CL-06 | CR8: over the limit, remaining negative | API | — | — |
| REQ-CL-06 | CR9–CR10: a zero limit | API | — | — |
| REQ-CL-06 | Boundary: `L = 1` with `T = 0`, `1` and `2` | API | — | — |
| REQ-CL-07 | Order and sum with zero rows | API | — | — |
| REQ-CL-08 | CR12: a paid instalment counts | API | — | — |
| REQ-CL-08 | CR13: an unpaid instalment does not | API | — | — |
| REQ-CL-09 | CR1: Uncategorised is never judged | API | — | — |
| REQ-CL-10 | An expense over a category limit is created | API | — | — |
| REQ-CL-06, REQ-CL-10 | Limits above the overall limit accepted; the two judged apart; writes independent | API | — | — |
| REQ-CL-11 | Within, reached and over on screen; no box without a limit | E2E | — | — |
| REQ-CL-11 | A limited category with nothing spent is listed | E2E | — | — |
| REQ-CL-11 | The row fits a 320 px screen | E2E | — | — |
| REQ-CL-12 | Set and clear from the editor | E2E | — | — |
| REQ-CL-12 | Zero, an invalid figure and Cancel | E2E | — | — |
| REQ-CL-09 | The Uncategorised row has no editor | E2E | — | — |
| REQ-CL-11, REQ-CL-12 | Set a limit and see its state, through a second browser stack | Selenium | — | — |
| REQ-CL-13 | An old database gains the column with every row `NULL`; booting again is safe; the `CHECK` holds | DB | — | — |

## 6. Change-impact analysis

| Area | Change | Risk to what exists |
|---|---|---|
| Database | `categories.monthly_limit_cents`, nullable with its `CHECK`, in `src/schema.sql` for a new database and added by a guarded `ALTER TABLE` in `src/db.js` to an existing one | Additive; every existing category reads `null`, no limit. The upgrade needs a test of its own, because every other suite starts from an empty file |
| `GET /api/categories` | each category gains `monthly_limit_cents` | Additive; its readers use `id` and `name` (the Add tiles, the editors, the AI review, the test helpers); the collection's `category` schema is updated deliberately |
| `POST /api/categories` | the response gains `monthly_limit_cents: null`; the request is unchanged, and a new category never has a limit | Additive; the create cases keep their assertions |
| `PATCH /api/categories/:id` | new: `monthly_limit_cents` only; `400`, `404` and `401` as elsewhere | A new route, so gate C6 needs a request for it; no new status code, so C8's set is unchanged |
| `GET /api/summary` | `by_category` rows gain `limit_cents`, `limit_status` and `limit_remaining_cents`; categories with a limit are listed at `total_cents: 0` | The top-level fields, the overall limit and "the parts add up to the whole" are unchanged; the second account's empty month still has no rows, because it has no limits; the row schema is updated deliberately |
| Server | `src/routes/categories.js` gains the route; `src/routes/summary.js` reads each category's limit and calls `limitState` per row; the existing validators `id`, `patchFields` and `limitCents` are reused | One judgement function serves both limits |
| Screen *This month* | a category row opens a limit editor — a sheet, like the expense editor; a limited row reads `€T of €L` and carries a status box; zero rows render; the donut skips rows with nothing spent | The header, the overall limit, the income, the expense list and paging are untouched; a row without a limit looks as before |
| Test ids | `category-limit-edit-{id}` on a row's control and `category-limit-status-{id}` on its status box; `category-limit-title`, `category-limit-input`, `category-limit-save` and `category-limit-cancel` in the editor. Deliberately **not** prefixed `category-bar-`, because the page object counts rows with `/^category-bar-/` | Gate C7: each is addressed from `qa/e2e/pages/month.page.js`. C3's fixed list is the original set and does not change |
| Tests | a new Postman folder 13; a new `test:db` case; new end-to-end cases; one Selenium check; the collection's two schemas; new catalogue rows | Existing cases are unchanged and must stay green |
| Documents | `spec/architecture.md` §§3–5 with its recorded hash (gate C1); the analysis models — a BPMN process, the use-case diagram and the ERD — and their index | C1 fails until the hash is refreshed in the same change: the gate doing its job |
| Not touched | the overall limit's rules, the schedules' own rules, AI expense entry, authentication, rate limiting, the load and race layers | — |

## 7. Change notes

### 2026-09-28 — correct the specification-completion claim

The earlier wording said the analysis, architecture and models were all frozen
on 2026-09-27. In fact only the analysis and architecture had been committed;
the category BPMN was an unfinished source, and the use-case diagram and ERD
did not yet include the feature. The completion statement above now names the
two dates accurately. The completed models distinguish planned category-limit
behaviour from implemented behaviour. CL-D1…CL-D12 and all requirements,
acceptance criteria and decision-table outcomes are unchanged. This is a
documentation correction, not a business-rule change. Implementation, test
results and owner UAT remain pending.

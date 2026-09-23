# Test cases · WALLET

**Python layer last executed 2026-09-07** against `spec/architecture.md` SHA-256
`233a027e…572ea`. Other statuses retain the session evidence named in their
sections; local Playwright execution additionally needs a host allowed to launch
Chromium.

The interface is English and money reads `€12.50` (D-018, D-019). Expected
values below are the current ones; the Slovak strings that used to be here are
not preserved, because this register describes what the app does now. The one
place the old strings survive on purpose is the BUG-003 report, which quotes
real captured output and would become a forgery if edited.

Every case is automated — a case that exists only in a document is a case nobody
runs. **Automated by** names the file that executes it, so any result traces
back to code.

**Traces to** is the column that makes this register auditable: every case
points at the clause it exists to check, or at the defect it exists to stop from
returning. A case that traces to neither is a case testing somebody's opinion,
and there are none here.

**Priority:** `P1` money is wrong, data leaks between users, or the app is
unusable · `P2` a documented requirement is not met · `P3` cosmetic.

**Status:** `PASS` · `FAIL` · `BLOCKED`, from the recorded test runs.

Preconditions for every case: the server is running, `npm run check` prints
`OK`, and the case owns a freshly created account. Rows are arranged through
the API unless the case is about creating them.

---

## API · Health and registration · `qa/api/wallet.postman_collection.json`

| ID | Case | Steps | Expected | Traces to | Pri | Status |
|---|---|---|---|---|---|---|
| TC-API-001 | Health check | `GET /api/health` | 200, `{status, version, db}`, `db` is `ok`, no auth | §5 health | P2 | PASS |
| TC-API-002 | Register | `POST /auth/register`, fresh e-mail | 201, body is `{token}` and nothing else | §5 register | P1 | PASS |
| TC-API-003 | Register a second user | Same, another e-mail | 201, token differs from TC-API-002 | §5 register | P1 | PASS |
| TC-API-004 | Duplicate e-mail | Re-register the TC-API-002 address | 409 `CONFLICT` | §5 status table | P2 | PASS |
| TC-API-005 | Password under 8 characters | Register with `"short"` | 400 `VALIDATION_FAILED` | §5 register | P2 | PASS |
| TC-API-006 | Password missing | No `password` field | 400 | §4.3 missing field | P2 | PASS |
| TC-API-007 | Sign in | `POST /auth/login`, correct credentials | 200, `{token}` | §5 login | P1 | PASS |
| TC-API-008 | Wrong password | Correct e-mail, wrong password | 401 `UNAUTHORIZED` | §5 login | P1 | PASS |
| TC-API-009 | Unknown e-mail is indistinguishable | Login with an unregistered address | 401 with **the same message** as TC-API-008 — the form must not reveal which addresses exist | §5 login (401) | P1 | PASS |

## API · Token handling

| ID | Case | Steps | Expected | Traces to | Pri | Status |
|---|---|---|---|---|---|---|
| TC-API-010 | No token | `GET /categories`, no header | 401 in the standard error shape | §5 (401 row) | P1 | PASS |
| TC-API-011 | Wrong scheme | `Authorization: Token <jwt>` | 401 | §5 auth header | P2 | PASS |
| TC-API-012 | Corrupted token | Valid token, last signature character flipped | 401 — header and payload untouched, so a server that only decoded would accept it | §5 (401: malformed) | P1 | PASS |
| TC-API-013 | Expired token | JWT signed with the real secret, `exp` 10 days past | 401. Asserts the token **is** expired before asserting the 401 | §5 (401: expired) | P1 | PASS |
| TC-API-014 | Another user's token is scoped to them | `GET /transactions` as user B | 200, `total` is 0 | §4.3 ownership | P1 | PASS |

## API · Categories

| ID | Case | Steps | Expected | Traces to | Pri | Status |
|---|---|---|---|---|---|---|
| TC-API-015 | Seeded on registration | `GET /categories` | 200, non-empty array matching the schema | §8 session 2 | P2 | PASS |
| TC-API-016 | Categories are per user | `GET /categories` as user B | 200, none of user A's ids present | §3 `UNIQUE(user_id,name)` | P1 | PASS |
| TC-API-017 | Create | `POST /categories` with name and emoji | 201, echoes name and icon | §5 categories | P2 | PASS |
| TC-API-018 | Duplicate name | Repeat TC-API-017 | 409 | §5 (409: duplicate category) | P2 | PASS |
| TC-API-019 | Blank name | `"   "` | 400 | §4.3 name empty | P2 | PASS |
| TC-API-020 | Name of 61 characters | One past the limit | 400 | §4.3 name > 60 | P2 | PASS |
| TC-API-021 | Name of exactly 60 | The allowed side of the boundary | 201, stored name is 60 long | §4.3 name > 60 | P2 | PASS |

## API · Transactions

| ID | Case | Steps | Expected | Traces to | Pri | Status |
|---|---|---|---|---|---|---|
| TC-API-022 | Create an expense | Amount + category | 201, `spent_on` defaults to today, amount returned as the integer sent | §5 POST transactions | P1 | PASS |
| TC-API-023 | `amount_cents` = 0 | Boundary | 400 | §4.3 amount ≤ 0 | P1 | PASS |
| TC-API-024 | `amount_cents` = 1 | Smallest legal | 201 | §4.3 amount ≤ 0 | P1 | PASS |
| TC-API-025 | `amount_cents` = ceiling | 100,000,000 = €1,000,000 | 201, value survives exactly | §4.3 amount > cap | P1 | PASS |
| TC-API-026 | `amount_cents` = ceiling + 1 | 100 000 001 | 400 | §4.3 amount > cap | P1 | PASS |
| TC-API-027 | Fractional amount | `12.5` | 400 — a fractional cent is a float that leaked in | §3 integer cents | P1 | PASS |
| TC-API-028 | Amount as a string | `"1250"` | 400, no coercion | §4.3 not an integer | P2 | PASS |
| TC-API-029 | Amount missing | No field | 400 | §4.3 missing | P2 | PASS |
| TC-API-030 | Truncated JSON body | Body cut mid-object | **400, not 500**, body is JSON not HTML | §5 (500 unreachable) | P1 | PASS |
| TC-API-031 | `spent_on` wrong format | `02/09/2026` | 400 | §4.3 spent_on format | P2 | PASS |
| TC-API-032 | `spent_on` 30 days ahead | §4.3 allows at most one day | 400 | §4.3 future date | P2 | PASS |
| TC-API-033 | Another user's `category_id` | Post with user B's category | **404, asserted not to be 403** | §4.3 (404 not 403) | P1 | PASS |
| TC-API-034 | List defaults to this month | `GET /transactions` | 200 `{items,total}`, newest first | §5 defaults, §6.2 | P2 | PASS |
| TC-API-035 | `limit=201` | One past the cap | 400 | §5 max limit 200 | P2 | PASS |
| TC-API-036 | `limit=200` | The cap itself | 200 | §5 max limit 200 | P2 | PASS |
| TC-API-037 | `from` later than `to` | Reversed range | 400 | §5 query params | P2 | PASS |
| TC-API-038 | Filter by another user's category | `?category_id=<B's>` | 404, not 403 — filtering must not become a probe | §4.3 (404 not 403) | P1 | PASS |
| TC-API-039 | Delete another user's row | `DELETE` as user B | 404, not 403 | §4.3 (404 not 403) | P1 | PASS |
| TC-API-040 | Delete | Own row | 204, empty body | §5 (204) | P2 | PASS |
| TC-API-041 | Delete again | Repeat TC-API-040 | 404 | §5 DELETE | P2 | PASS |
| TC-API-042 | Non-numeric id | `/transactions/not-a-number` | 400 | §5 (400) | P3 | PASS |

## API · Schedules and loans

| ID | Case | Steps | Expected | Traces to | Pri | Status |
|---|---|---|---|---|---|---|
| TC-API-043 | Create a subscription | No `total_count` | 201, `total_count`/`remaining_*` all null | §3, §5 remaining_* null | P1 | PASS |
| TC-API-044 | `day_of_month` = 0 | Boundary | 400 | §4.3 day outside 1–31 | P2 | PASS |
| TC-API-045 | `day_of_month` = 1 | Lowest legal | 201, `next_due` on the 1st | §4.1 | P2 | PASS |
| TC-API-046 | `day_of_month` = 28 | Exists in every month | 201, `next_due` on the 28th | §4.1 | P2 | PASS |
| TC-API-047 | `day_of_month` = 31 starting in February | The case that breaks naive implementations | 201, `next_due` is the **last day of that February** (29 in a leap year) — clamped, not skipped | §4.1 clamp table | P1 | PASS |
| TC-API-048 | `day_of_month` = 32 | Boundary | 400 | §4.3 day outside 1–31 | P2 | PASS |
| TC-API-049 | `total_count` = 0 | Boundary | 400 | §4.3 total_count ≤ 0 | P2 | PASS |
| TC-API-050 | `starts_on` = `2026-13-45` | Date-shaped, not a date | 400 | §4.3 date format | P2 | PASS |
| TC-API-051 | Create a loan | `total_count` 2 | 201, `paid_count` 0, `remaining_count` 2, `remaining_cents` = 2 × amount | §4.2 countdown | P1 | PASS |
| TC-API-052 | List sorted and consistent | `GET /schedules` | Sorted by `next_due` ascending; on every loan `remaining_cents` = `remaining_count` × `amount_cents` | §5 sorted, §4.2 | P1 | PASS |
| TC-API-053 | Active filter | `?active=1` | Every row has `active` 1 | §5 active filter | P2 | PASS |
| TC-API-054 | Pay an instalment | `PATCH /:id/pay` | 200, `paid_count` 1, `remaining_count` 1, `finished` false | §4.2 | P1 | PASS |
| TC-API-055 | The payment created a transaction | Read back the returned id | Row exists, `schedule_id` links it, amount is the instalment | §4.2 (row with schedule_id) | P1 | PASS |
| TC-API-056 | Pay the last instalment | `PATCH` again | 200, `remaining_count` 0, `finished` **true** | §4.2 finished | P1 | PASS |
| TC-API-057 | Pay a closed loan | `PATCH` once more | **409, asserted not to be 400** — a state transition, not bad input | §4.2 (409) | P1 | PASS |
| TC-API-058 | Closed loan leaves the active list | `?active=1` | Its id is absent | §4.2 `active = 0` | P2 | PASS |
| TC-API-059 | Pay another user's schedule | `PATCH` as user B | 404, not 403 | §4.3 (404 not 403) | P1 | PASS |
| TC-API-060 | Pay a schedule that does not exist | `/schedules/99999999/pay` | 404 | §5 (404) | P2 | PASS |

## API · Summary and contract edges

| ID | Case | Steps | Expected | Traces to | Pri | Status |
|---|---|---|---|---|---|---|
| TC-API-061 | Month summary | `GET /summary` | 200; per-category totals **add up to** the month total; month defaults to the current one | §5 summary | P1 | PASS |
| TC-API-062 | Explicit month | `?month=2026-01` | 200, answers for that month | §5 summary | P2 | PASS |
| TC-API-063 | Malformed month | `?month=January` | 400 | §5 summary param | P2 | PASS |
| TC-API-064 | Summary is per user | As user B while A has spent | 200, total 0, empty breakdown | §4.3 ownership | P1 | PASS |
| TC-API-065 | Unknown `/api` path | `GET /api/nope-<run>` | 404 in JSON, no `<html` in the body | §5 (404), §5 JSON contract | P2 | PASS |
| TC-API-066 | 403 is unreachable | Cross-user read from the opposite direction | 404, asserted not to be 403. §5 lists 403, but this application answers 404 for everything a user may not see, so the property that replaced it is what is asserted | §4.3, §5 (403 row) | P1 | PASS |

## API · Login rate limiting · folder `09`

The limits come from the runner as globals, so these cases do not hard-code the
boundary they test. Two of them wait for real time to pass — everywhere else a
fixed wait is forbidden, but a window that expires on a schedule cannot be
tested without letting the schedule run.

| ID | Case | Steps | Expected | Traces to | Pri | Status |
|---|---|---|---|---|---|---|
| TC-API-067 | A failure inside the allowance | Wait out the window, then one wrong password | 401, explicitly **not** 429 | §5 (429), D-016 | P1 | PASS |
| TC-API-068 | Up to one below the limit | Repeat until the last allowed attempt is used | Every one is 401 with the error schema; loops on the configured limit, not on a literal 5 | §5 (429), D-016 | P1 | PASS |
| TC-API-069 | One past the limit | One more wrong password | **429** `RATE_LIMITED`, `Retry-After` present and above zero | §5 (429), **BUG-004** | P1 | PASS |
| TC-API-070 | The block does not leak account existence | Read the 429 message | Says nothing about the password or whether the account exists | §5 (401 wording), D-016 | P1 | PASS |
| TC-API-071 | The correct password while blocked | Send the real password during the block | Still 429 — being right must not lift it, or it protects nothing | D-016 | P1 | PASS |
| TC-API-072 | The window lifts by itself | Wait out the window, try again | 401 — no administrator, no reset endpoint. Otherwise anyone knowing an e-mail could lock its owner out | D-016 (rejected: account lockout) | P1 | PASS |
| TC-API-073 | A successful login clears the counter | Sign in correctly after failures | 200; the earlier failures do not block it | D-016 | P2 | PASS |

## API · Settings and the month balance · folder `08`

Monthly income (D-021). Zero is how "not set" is expressed — §3 forbids a
negative income, so zero cannot mean anything else.

| ID | Case | Steps | Expected | Traces to | Pri | Status |
|---|---|---|---|---|---|---|
| TC-API-074 | Fresh account | `GET /settings` before anything is set | 200, `monthly_income_cents` is 0 — not a 404 | §5 settings, D-021 | P2 | PASS |
| TC-API-075 | Set an income | `PUT` 150000 | 200, echoes the figure | §5 settings | P1 | PASS |
| TC-API-076 | A second write replaces the first | `PUT` 200000 | 200, reads back 200000 — upsert, not a second row | §3 (PRIMARY KEY) | P1 | PASS |
| TC-API-077 | Zero is legal | `PUT` 0 | 200 — zero means "not set" | §3 CHECK ≥ 0 | P2 | PASS |
| TC-API-078 | Negative | `PUT` −1 | 400 | §3 CHECK ≥ 0 | P1 | PASS |
| TC-API-079 | Fractional | `PUT` 12.5 | 400 — a fractional cent is a float that leaked in | §3 integer cents | P1 | PASS |
| TC-API-080 | As a string | `PUT` "150000" | 400, no coercion | §4.3 not an integer | P2 | PASS |
| TC-API-081 | Missing field | `PUT {}` | 400 | §4.3 missing | P2 | PASS |
| TC-API-082 | Above the ceiling | `PUT` 100000001 | 400 — same ceiling as amount_cents | §4.3 amount > cap | P2 | PASS |
| TC-API-083 | No token | `GET /settings` with no header | 401 | §5 (401 row) | P1 | PASS |
| TC-API-087 | Income = 1 | `PUT` 1 | 200 — the smallest income that means anything, since 0 means "not set" | test-design §2 | P2 | PASS |
| TC-API-088 | Income = the ceiling exactly | `PUT` 100 000 000 | 200, survives exactly. Only ceiling+1 had a case; an off-by-one would have passed the old pair | test-design §2, §4.3 | P1 | PASS |
| TC-API-089 | Income explicitly null | `PUT` null | 400 — a different path through the validator from "absent" | test-design §2 | P2 | PASS |
| TC-API-090 | `PUT /settings` with no token | Write with no header | 401. Only `GET` had been asked; a write is the one worth being sure about | test-design §3 | P1 | PASS |
| TC-API-084 | Summary carries the income | `GET /summary` | `income_cents` is the figure just written | §5 summary, D-021 | P1 | PASS |
| TC-API-085 | Remaining is exact | Same response | `remaining_cents` = `income_cents` − `total_cents`, to the cent | §5 summary, D-021 | P1 | PASS |
| TC-API-086 | Income does not leak between users | `GET /settings` as user B | 200, 0 — user B has their own | §4.3 ownership | P1 | PASS |

## API · Monthly spending limit · folder `12`

The limit a person sets for the month, and the state it produces. Requirements,
the decision table these rows come from, the boundary list and the traceability
matrix are in [`analysis-monthly-limit.md`](analysis-monthly-limit.md). `T` is
the month total, `L` the limit.

| ID | Case | Steps | Expected | Traces to | Pri | Status |
|---|---|---|---|---|---|---|
| TC-API-091 | Set a limit | `PUT /settings` with `monthly_limit_cents` 12000 | 200, echoes 12000; a later `GET` returns it; the income is untouched | REQ-ML-01 | P1 | PASS |
| TC-API-092 | Clear a limit | `PUT` with `monthly_limit_cents: null` | 200, then `GET` reports `null` — "no limit", not zero | REQ-ML-02, A3 | P1 | PASS |
| TC-API-093 | Omission is not a change | `PUT` with the income only | 200, the stored limit is unchanged | REQ-ML-03 | P2 | PASS |
| TC-API-094 | Summary carries limit, state and what is left | `GET /summary` with a limit set | `limit_cents`, `limit_status`, `limit_remaining_cents` = `L − T` to the cent, state per the table | REQ-ML-04 | P1 | PASS |
| TC-API-095 | No limit → `not_set` (R1, R2) | `GET /summary` with no limit, on an empty month and on a month with spending | `not_set`, both money fields `null`, the month total unchanged | REQ-ML-05 R1–R2 | P1 | PASS |
| TC-API-096 | Within the limit (R3, R4) | `L` above `T`, including `T = 0` | `within`, what is left is exactly `L − T` | REQ-ML-05 R3–R4 | P1 | PASS |
| TC-API-097 | Exactly at the limit (R5) | `L = T` | `reached`, what is left is `0` — not `exceeded` | REQ-ML-05 R5, A4 | P1 | PASS |
| TC-API-098 | One cent over (R6) | `L = T − 1` | `exceeded`, what is left is `−1` | REQ-ML-05 R6 | P1 | PASS |
| TC-API-099 | A zero limit is a limit (R7, R8) | `L = 0` with `T = 0`, then with `T > 0` | `reached`, then `exceeded` with `−T` left | REQ-ML-05 R7–R8, A3 | P1 | PASS |
| TC-API-100 | The smallest limit above zero | `L = 1` on an empty month | `within`, one cent left | boundary list §4 | P2 | PASS |
| TC-API-101 | The limit never blocks a save | Create an expense while over the limit | 201; the total and the state both move; nothing is refused | REQ-ML-06, A1 | P1 | PASS |
| TC-API-102 | Invalid limits | −1, 12.5, `"12000"`, `true`, ceiling + 1 | 400 `VALIDATION_FAILED` each; a following `GET` shows the limit unchanged | REQ-ML-07 | P1 | PASS |
| TC-API-103 | The ceiling exactly | `L` = 100 000 000 | 200, stored exactly | REQ-ML-07 | P2 | PASS |
| TC-API-104 | A limit belongs to one account | Second account sets its own limit | Each account reads its own; neither sees the other's | REQ-ML-08 | P1 | PASS |
| TC-API-105 | No token | `GET` and `PUT /settings` with no header | 401 both | REQ-ML-08 | P1 | PASS |

## Python API scenarios · `qa/python/test_api.py`

This is a complementary layer, not a second copy of the Newman collection
(`D-032`). It owns a temporary database, process, port and secret through its
fixture, then uses an independent HTTP client for the input classes and state
flows below.

| ID | Case | Steps | Expected | Traces to | Pri | Status |
|---|---|---|---|---|---|---|
| TC-PY-001 | Parameterized transaction validation | Send missing, negative, zero, fractional, string, boolean and malformed-date variants | Every class returns JSON 400, never INTERNAL | §4.3, test-design §2 | P1 | PASS |
| TC-PY-002 | Malformed JSON stays contractual | Send an incomplete JSON body to transactions | JSON 400, not an HTML page or 500 | §5 JSON contract | P1 | PASS |
| TC-PY-003 | Rejected token forms | Call a protected route with no, malformed, corrupted and genuinely expired token | Every form returns 401 | §5 (401), test-design §3 | P1 | PASS |
| TC-PY-004 | Cross-user view and change isolation | Owner creates an expense; another user lists, patches and deletes it | Row is invisible in the list; PATCH and DELETE return 404, never 403 | §4.3 | P1 | PASS |
| TC-PY-005 | Expense lifecycle | Set income; create, partially edit, read summary, then delete an expense | Edited cents appear in summary and remaining amount; delete restores total to zero | §5 transactions and summary, D-029 | P1 | PASS |
| TC-PY-006 | Loan state lifecycle | Create a two-instalment loan; pay twice; try a third payment | Active → finished with count 0; third payment is 409 | §4.2 | P1 | PASS |

## Load · `qa/load/`

Measured, not asserted-by-feel: every run records `GET /api/health` idle **and**
under load, and the finding is the difference between them (R6).

| ID | Case | Steps | Expected | Traces to | Pri | Status |
|---|---|---|---|---|---|---|
| TC-LOAD-001 | Concurrent writes | 50 users writing expenses for 30 s | No 5xx, no `SQLITE_BUSY`, no lost write. Health stays under 250 ms at p95 | **LIMIT-001** | P1 | PASS |
| TC-LOAD-002 | A burst of failed logins | 20 connections sending wrong passwords for 15 s | Health stays under 250 ms at p95 while the guessing happens | **BUG-004**, D-016 | P1 | PASS |
| TC-LOAD-003 | The logins the limiter allows | 5 concurrent wrong passwords against a server with the limiter switched off | Health stays under 100 ms at p95 — the residual BUG-004 recorded, now discharged | **BUG-004** residual, D-024 | P1 | PASS |

## End-to-end · Authentication · `qa/e2e/auth.spec.js`

| ID | Case | Steps | Expected | Traces to | Pri | Status |
|---|---|---|---|---|---|---|
| TC-E2E-001 | Register through the form | Fill and submit in register mode | Lands on Add; seeded tiles and navigation visible | §6, §8 s.1 | P1 | PASS |
| TC-E2E-002 | Sign in again | Clear the session, reload, sign in | Returns to the app | §6 | P1 | PASS |
| TC-E2E-003 | Wrong password | Submit a wrong password | Error toast, still on sign-in, no session | §5 (401) | P1 | PASS |
| TC-E2E-004 | Empty form | Submit with both fields blank | `Enter both an e-mail and a password`, nothing sent | §6 | P3 | PASS |
| TC-E2E-005 | Stored session | Token in local storage, open `/` | The app opens directly | §6 | P2 | PASS |

## End-to-end · Adding an expense · `qa/e2e/add-expense.spec.js`

| ID | Case | Steps | Expected | Traces to | Pri | Status |
|---|---|---|---|---|---|---|
| TC-E2E-006 | **Definition of done** — two taps and a save | Type 1250, tap a category, tap Save, open Month | `€12.50`; success toast; amount and selection reset; month total `€12.50` with one row | **§8 session 4 DoD**, §6.1 | P1 | PASS |
| TC-E2E-007 | Keypad and clear | Press 9, 9, 9 then C | `€0.09` → `€0.99` → `€9.99` → `€0.00` | §6.1 keypad | P2 | PASS |
| TC-E2E-008 | Save with no amount | Tap a category, save | `Enter an amount` | §4.3 amount ≤ 0 | P2 | PASS |
| TC-E2E-009 | Save with no category | Enter an amount, save | `Choose a category` | §6.1 two taps | P2 | PASS |
| TC-E2E-010 | Two expenses, two categories | Add both, open Month | Total is the sum; two rows, two bars | §6.2 | P1 | PASS |
| TC-E2E-039 | A note becomes the row title | Add €40 to Other with the note "new tyre" | The row reads `new tyre` with `Other` beneath — the point of D-020 | D-020 | P1 | PASS |
| TC-E2E-040 | The note is cleared after saving | Save an expense with a note | The field is empty, so it cannot attach to the next expense | D-020 | P1 | PASS |
| TC-E2E-041 | An expense with no note shows its category | Save without a note | The row falls back to its category name | D-020 | P2 | PASS |
| TC-E2E-011 | Every tile has a readable name | Look each seeded category up by role and name | All found by role **and** by test id | D-012 | P2 | PASS |

## End-to-end · Income and the donut · `qa/e2e/income.spec.js`

The arithmetic is asserted rather than the picture. A donut is easy to draw
subtly wrong and hard to assert on; the numbers beside it are neither.

| ID | Case | Steps | Expected | Traces to | Pri | Status |
|---|---|---|---|---|---|---|
| TC-E2E-031 | A fresh account asks rather than invents | Open Month on a new account | `Set income`, and `—` where the remainder goes — not `€0.00 left` | D-021 | P1 | PASS |
| TC-E2E-032 | Setting an income shows what is left | Set 1500.00 with €125.50 already spent | Income €1,500.00, spent €125.50, left €1,374.50 | §5 summary, D-021 | P1 | PASS |
| TC-E2E-033 | The income is stored, not remembered | Set it, reload the page | Still there — it survives the browser | §3 settings table | P1 | PASS |
| TC-E2E-034 | Overspending says Over | Spend €600 against €500 | The label reads `Over`, the figure is €100.00 | D-021 | P1 | PASS |
| TC-E2E-035 | Cancelling changes nothing | Open the editor, type, cancel | The original figure is intact | D-021 | P2 | PASS |
| TC-E2E-036 | A malformed income is refused | Type "a lot", save | Error toast, income unchanged | §4.3 | P2 | PASS |
| TC-E2E-042 | Spending with no income set | Add an expense, open Month without setting an income | `Set income`, remainder `—`, and the donut still draws the spend | test-design §6 row 2 | P2 | PASS |
| TC-E2E-043 | An income with nothing spent | Set an income on an empty month | Left is the whole income, no arcs | test-design §6 row 3 | P2 | PASS |
| TC-E2E-044 | Spending **exactly** the income | Spend €500 against €500 | Label stays `Left`, figure is `€0.00` — not `Over €0.00`. The boundary between rows 4 and 6 | test-design §6 row 5 | P1 | PASS |
| TC-E2E-037 | One arc per category | Two categories with spending | Two slices, each addressable by its category id | D-022 | P2 | PASS |
| TC-E2E-038 | An empty month draws nothing | Open Month on a new account | The donut is present, zero slices, no crash | D-022 | P2 | PASS |

## End-to-end · This month · `qa/e2e/month.spec.js`

| ID | Case | Steps | Expected | Traces to | Pri | Status |
|---|---|---|---|---|---|---|
| TC-E2E-012 | Total, bars and list agree | Two expenses via API, open Month | Total is the sum; a row and a bar per category | §6.2 | P1 | PASS |
| TC-E2E-013 | Bars carry their share | €75.00 and €25.00 | `75%` and `25%` in the bars' accessible names | §6.2, §9 (bars are divs) | P2 | PASS |
| TC-E2E-014 | Delete an expense | Tap the delete control on one row | Row gone, other row stays, total drops by exactly that amount | §5 DELETE, §6.2 | P1 | PASS |
| TC-E2E-015 | Empty month | Open Month on a new account | `€0.00`, no rows, no bars | §6.2 | P2 | PASS |
| TC-E2E-016 | Another user's expenses are invisible | Swap the session to a second account | `€0.00`, no rows | §4.3 ownership | P1 | PASS |
| TC-E2E-065 | The limit and what is left are on the screen | Limit €200.00, spend €50.00, open Month | The limit reads €200.00; the state line says *Within limit* and €150.00 | REQ-ML-09 | P1 | PASS |
| TC-E2E-066 | Over the limit is words, not only colour | Limit €100.00, spend €125.00 | The state line says *Over limit* with €25.00 and carries the over class | REQ-ML-09, RISK-ML-6 | P1 | PASS |
| TC-E2E-067 | Set the limit from the screen | Type 60.00 into the limit editor and save | The limit and the state update without a reload; the API agrees | REQ-ML-10 | P1 | PASS |
| TC-E2E-068 | Clear the limit from the screen | Empty the field and save | The screen offers to set one again, the state line is gone, the API reports `null` | REQ-ML-10, A3 | P2 | PASS |
| TC-E2E-069 | A figure that is not a number | Type "not a number" and save | Error toast; the shown and stored limits are unchanged | REQ-ML-10 | P2 | PASS |

## End-to-end · Schedules · `qa/e2e/schedules.spec.js`

| ID | Case | Steps | Expected | Traces to | Pri | Status |
|---|---|---|---|---|---|---|
| TC-E2E-017 | Create a subscription | Fill the form without ticking the box | Success toast, one row with the name | §6.4 | P2 | PASS |
| TC-E2E-018 | The checkbox is the only branch | Tick and untick `Je to pôžička` | `total_count` hidden → shown → hidden | §6.4 | P2 | PASS |
| TC-E2E-019 | A loan shows its countdown at once | Create a 10-instalment loan | `10 of 10 left · €1,000.00` | §4.2, §6.3 | P1 | PASS |
| TC-E2E-020 | The 31st is accepted and explains itself | Enter day 12, then 31; save with a February start | Hint only for days past 28; next charge is the last day of February | §4.1, D-011 | P1 | PASS |
| TC-E2E-021 | Malformed amount | `not a number` | `Amount must be a number, for example 15.00`, nothing created | §4.3 amount | P2 | PASS |
| TC-E2E-022 | Day outside 1–31 | Day 32 | `Day of month must be between 1 and 31`, nothing created | §4.3 day | P2 | PASS |
| TC-E2E-023 | A schedule created via API is displayed | Create with the API, open the screen | Name, amount and `Subscription` on its row | §5, §6.4 | P2 | PASS |

## End-to-end · Upcoming and payment · `qa/e2e/upcoming.spec.js`

| ID | Case | Steps | Expected | Traces to | Pri | Status |
|---|---|---|---|---|---|---|
| TC-E2E-024 | A loan counts down and closes | Pay a 3-instalment loan three times | `3 of 3` → `2 of 3` → `1 of 3` → **`0 of 3`**; finished state; pay button gone | §4.2, §6.3 | P1 | PASS |
| TC-E2E-025 | A subscription never finishes | Pay a subscription once | Still payable, still `Subscription`, no finished state | §3 (NULL = subscription) | P2 | PASS |
| TC-E2E-026 | Paying records the expense | Pay, then open Month | Month total rises by the instalment; the row carries the schedule's name | §4.2 | P1 | PASS |
| TC-E2E-027 | A closed loan leaves Upcoming | Close it, reload | Not listed | §4.2 `active = 0`, §6.3 | P2 | PASS |
| TC-E2E-028 | Ordered by next charge | Two schedules, days 1 and 28 | Screen order matches the API's `next_due` order | §5 sorted, §6.3 | P2 | PASS |
| TC-E2E-029 | The pay button says what it pays | Look it up by role and name | Found as `Pay Netflix` | §6.3, D-012 | P2 | PASS |

## End-to-end · Double submission · `qa/e2e/double-submit.spec.js`

| ID | Case | Steps | Expected | Traces to | Pri | Status |
|---|---|---|---|---|---|---|
| TC-E2E-045 | Two fast expense saves | Tap Save twice before the first request completes | Exactly one expense exists; the control is disabled synchronously | LIMIT-002, D-030 | P1 | PASS |
| TC-E2E-046 | Repeated schedule submit | Press Enter twice in the schedule form | Exactly one schedule exists | LIMIT-002, D-030 | P1 | PASS |
| TC-E2E-047 | Intentional second expense | Save, wait for completion, then save again | Two rows exist — separate user actions must not be deduplicated | LIMIT-002 | P2 | PASS |

## End-to-end · Editing · `qa/e2e/editing.spec.js`

| ID | Case | Steps | Expected | Traces to | Pri | Status |
|---|---|---|---|---|---|---|
| TC-E2E-048 | Edit amount updates all month views | Change an expense amount | Row, total and donut update consistently | D-029, §6.2 | P1 | PASS |
| TC-E2E-049 | Partial edit preserves other fields | Change one value in the editor | Unchanged fields retain their previous values | D-029 PATCH | P1 | PASS |
| TC-E2E-050 | Cancel edit | Open editor, change a value, cancel | Row remains unchanged | D-029 | P2 | PASS |
| TC-E2E-051 | Deleted elsewhere while editing | Delete the row through the API before Save | UI reports the conflict and refreshes | D-029, §5 404 | P1 | PASS |
| TC-E2E-052 | Rejected edit retains editor state | Send an amount the API refuses | Editor stays open and the stored row stays unchanged | D-029, §4.3 | P1 | PASS |
| TC-E2E-053 | Keyboard opens editor | Focus a row and use the keyboard action | Same editor opens without a pointer | §6 accessibility | P2 | PASS |

## End-to-end · Pagination · `qa/e2e/pagination.spec.js`

| ID | Case | Steps | Expected | Traces to | Pri | Status |
|---|---|---|---|---|---|---|
| TC-E2E-054 | One-page month | Create no more than 50 expenses | No paging controls are shown | D-031 | P2 | PASS |
| TC-E2E-055 | One row past a page | Create 51 expenses | Show-more control and honest count appear | D-031 | P1 | PASS |
| TC-E2E-056 | The old 200-row cap | Create 201 expenses and page through them | All rows are reachable and total agrees | D-031 | P1 | PASS |
| TC-E2E-057 | Delete after paging | Load multiple pages, then delete one row | Count and remaining rows stay consistent | D-031 | P1 | PASS |

## End-to-end · Free text safety · `qa/e2e/security.spec.js`

| ID | Case | Steps | Expected | Traces to | Pri | Status |
|---|---|---|---|---|---|---|
| TC-E2E-058 | Script-tag expense note | Save a note containing a script tag | Payload is rendered as text and does not run | XSS audit S16 | P1 | PASS |
| TC-E2E-059 | Event-handler expense note | Save an image/onerror-style payload | Payload is rendered as text and does not run | XSS audit S16 | P1 | PASS |
| TC-E2E-060 | Closing-tag expense note | Save a closing-tag/script payload | Payload is rendered as text and does not run | XSS audit S16 | P1 | PASS |
| TC-E2E-061 | Script-tag schedule name | Save a schedule with a script payload | Name is rendered as text and does not run | XSS audit S16 | P1 | PASS |
| TC-E2E-062 | Free text survives editing | Round-trip a payload through the editor | Stored text survives unchanged and never executes | XSS audit S16, D-029 | P1 | PASS |

## End-to-end · Regressions · `qa/e2e/regressions.spec.js`

Named after the defect each one guards. Every one of these has been shown to
fail when its defect is put back — see S05.

| ID | Case | Steps | Expected | Traces to | Pri | Status |
|---|---|---|---|---|---|---|
| TC-REG-001 | The Save button is legible | Read the **computed** colour and the effective background of the save button; compute the WCAG ratio | Colours differ **and** contrast ≥ 4.5:1. `toBeVisible()` and `toHaveText()` are asserted first — those are what BUG-001 passed while the button was invisible | **BUG-001** | P1 | PASS |
| TC-REG-002 | The counter reads zero after the last instalment | Pay a 2-instalment loan to the end | `0 of 2 left · €0.00`, finished state shown, pay button gone | **BUG-002**, §4.2 | P1 | PASS |
| TC-REG-003 | The pay button recovers after a refusal | Close the loan behind the screen's back, then press Pay | Conflict toast; button back to `Pay`, enabled | **BUG-003**, §4.2 (409) | P1 | PASS |

---

## Totals

| | Cases | Runs | Status |
|---|---|---|---|
| API — 171 requests, 621 assertions | 105 | 171 | all PASS |
| Python — 6 documented scenarios, 13 pytest items | 6 | 13 | all PASS |
| Load — 3 scenarios, thresholds enforced | 3 | 3 | all PASS |
| End-to-end — 69 tests × 2 viewports | 69 | 138 | all PASS; local browser run requires a host that permits Chromium |
| **Total** | **183** | **325** | **documented cases PASS; local browser execution environment noted above** |

**The counts are checked against the suites, not typed from memory.** An earlier
count claimed 138 cases while only 135 rows existed; three cases (TC-E2E-039…041)
had passing tests and no rows here at all.

**TC-E2E-030 is retired, not missing.** It covered a refused payment and became
TC-REG-003 when the regression file was created in S05. The number is left
unused rather than recycled: reusing an id makes an old result refer to a
different case.

Seven of those cases (TC-API-087…090, TC-E2E-042…044) exist because the income
feature was run back through `qa/docs/test-design.md` **after** it shipped. None
of them found a defect; all seven were classes the procedure names and a person
writing tests by hand had skipped.

The twenty monthly-limit cases (TC-API-091…105, TC-E2E-065…069) were written the
other way round: from the requirements and the decision table in
[`analysis-monthly-limit.md`](analysis-monthly-limit.md), before the feature
existed, and each one failed before it passed.

API cases number 73 against 75 requests because TC-API-068 loops: one request,
run once per allowed attempt.

Traceability: every case above cites a clause of `spec/architecture.md`, a recorded
decision, or a `BUG-###`. Three cases trace to defects, and each of those three
has been re-verified against the defect it guards.

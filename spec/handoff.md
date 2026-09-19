# WALLET — build handoff

**Give this file to the chat that will write the code. It is self-contained.**

---

> ## INSTRUCTIONS FOR THE BUILDING CHAT
>
> You are helping Daniil build a small personal-finance web app. He writes the
> code; you assist. Speak Ukrainian to him; keep code and comments in English.
>
> **The scope in this document is the whole scope.** He has already rejected a
> larger version of this project as over-engineered. Do not propose extra
> features, do not add a framework, do not add libraries beyond the four listed.
> If something here is ambiguous, pick the simpler reading.
>
> **Non-negotiable technical decisions** (already made — do not re-litigate):
> money is stored as integer cents; no float arithmetic on money anywhere; no
> frontend framework; SQLite, not a hosted database; every interactive element
> carries a `data-testid`.
>
> **Why the testids matter:** automated tests will be run against this app, and
> the attributes must be there from the start, because retrofitting them is
> tedious. The test layer lives in this repository, in `qa/` (D-010, 2026-09-02
> — this replaces the original "a separate project handles it; do not build any
> test infrastructure here"). It is built after the four sessions below, not
> during them.
>
> Build in the four sessions listed at the end, in order. Each has a definition
> of done. Do not start the next one until the previous is running.

---

## 1. WHAT IT IS

A phone-first web app for tracking money going out. Three things:

1. **Expenses** — open the phone after the shop, tap the amount, tap a category,
   done. Two taps.
2. **Recurring charges** — "the 12th of every month, 15 € for the phone".
3. **Loans** — "€1000 over 10 months, €100 a month" → it counts down and says
   when the last instalment is paid.

**The insight that keeps it small:** these are one entity at three moments.
An expense already happened. A subscription will happen and repeats forever. A
loan instalment will happen, repeats, and stops after N times. So there is one
table for money that moved and one for money that will move, and a loan is
simply a schedule with a finite instalment count.

**An optional second way to start an expense** (D-033, 2026-09-14): on Add the
person may type one short description, get an editable draft and save it with
the same Save as always. Off by default; the keypad is unchanged. The model
proposes, the server verifies, the person decides — it never saves anything on
its own. The full contract is `spec/ai-expense-entry.md`.

## 2. STACK — fixed

| | |
|---|---|
| Runtime | Node.js 20+ |
| Server | Express |
| DB | SQLite via `better-sqlite3` — a single file, no service to run |
| Auth | `jsonwebtoken`, HS256, secret from `.env` |
| Frontend | plain HTML + CSS + vanilla JS. **No React, no Vue, no Tailwind, no build step** |
| Passwords | `bcrypt` |

Four dependencies total: `express`, `better-sqlite3`, `jsonwebtoken`, `bcrypt`.

Runs with `npm start`. No Docker required. No external API. No internet needed
after `npm install`.

## 3. DATA MODEL

SQLite has no date or boolean types. Dates are `TEXT` in `YYYY-MM-DD`,
timestamps are ISO-8601 strings, booleans are `INTEGER` 0/1. All dates are
**local dates with no timezone conversion** — this is a personal app and the
simplification is deliberate; write it in a comment so it is a decision and not
an accident.

```sql
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE categories (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name    TEXT NOT NULL,
  icon    TEXT,                      -- an emoji, e.g. '🛒'
  UNIQUE (user_id, name)
);

CREATE TABLE schedules (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT    NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  category_id  INTEGER REFERENCES categories(id),
  day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  starts_on    TEXT    NOT NULL,     -- YYYY-MM-DD
  total_count  INTEGER,              -- NULL = subscription; N = loan of N instalments
  paid_count   INTEGER NOT NULL DEFAULT 0,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  CHECK (total_count IS NULL OR total_count > 0),
  CHECK (paid_count >= 0)
);

CREATE TABLE transactions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  category_id  INTEGER REFERENCES categories(id),
  spent_on     TEXT    NOT NULL,     -- YYYY-MM-DD
  note         TEXT,
  schedule_id  INTEGER REFERENCES schedules(id),  -- set when auto-generated
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- One row per user, at most. Monthly income (D-021, 2026-09-02): a single
-- figure that applies to every month. What remains is computed on read, never
-- stored, for the same reason next_due is not stored.
CREATE TABLE settings (
  user_id             INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  monthly_income_cents INTEGER NOT NULL DEFAULT 0 CHECK (monthly_income_cents >= 0)
);

CREATE INDEX idx_tx_user_date ON transactions (user_id, spent_on);
CREATE INDEX idx_sched_user   ON schedules (user_id, active);
```

**Money is `amount_cents`, an integer, everywhere.** €15.00 is `1500`. Converting
to a display string happens only at the edge, in the browser. Reason worth
knowing: `0.1 + 0.2 !== 0.3` in floating point, and money in floats produces
totals that cannot be reconciled months later.

**A loan is not a separate concept.** `total_count = 10, paid_count = 3` means
seven instalments left. `total_count IS NULL` means a subscription that never
ends.

## 4. BUSINESS RULES

### 4.1 `nextDue(day_of_month, from_date)` — the only real algorithm

Returns the next date this schedule will be charged.

```
function nextDue(dayOfMonth, fromDate):
    candidate = clampToMonth(fromDate.year, fromDate.month, dayOfMonth)
    if candidate >= fromDate:
        return candidate
    (y, m) = monthAfter(fromDate.year, fromDate.month)
    return clampToMonth(y, m, dayOfMonth)

function clampToMonth(year, month, day):
    last = daysInMonth(year, month)          // 28, 29, 30 or 31
    return date(year, month, min(day, last))
```

**Clamp, never skip.** A schedule set to the 31st must charge on 28 February,
not disappear in February. This is the case that breaks naive implementations.

Required behaviour:

| day_of_month | today | expected |
|---|---|---|
| 12 | 2026-03-05 | 2026-03-12 |
| 12 | 2026-03-20 | 2026-04-12 |
| 12 | 2026-03-12 | 2026-03-12 (today counts) |
| 31 | 2026-02-10 | **2026-02-28** |
| 31 | 2028-02-10 | **2028-02-29** (leap) |
| 31 | 2026-04-10 | 2026-04-30 |
| 12 | 2026-12-20 | 2027-01-12 |

### 4.2 Loan countdown

- `remaining_count  = total_count - paid_count`
- `remaining_cents  = remaining_count * amount_cents`
- Paying an instalment: `paid_count += 1`, and a `transactions` row is created
  with `schedule_id` set.
- When `paid_count >= total_count`: set `active = 0`. The API response for that
  call must carry `"finished": true` so the UI can celebrate.
- **Paying an inactive schedule is rejected with 409.** This is a state
  transition, not a validation error.

### 4.3 Validation — reject with 400

- `amount_cents` missing, not an integer, ≤ 0, or > 100 000 000 (1 000 000 €)
- `day_of_month` outside 1–31
- `spent_on` not `YYYY-MM-DD`, or more than one day in the future
- `category_id` that does not exist **or belongs to another user** → 404, not 403
  (do not confirm the existence of other users' rows)
- `name` empty or longer than 60 characters
- `total_count` present and ≤ 0

## 5. API

Base path `/api`. JSON in, JSON out. `Authorization: Bearer <token>` on
everything except `/health`, `/auth/register`, `/auth/login`.

**Every error response has the same shape** — this matters, because a consistent
error contract is what makes a response schema testable:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "amount_cents must be a positive integer" } }
```

Status codes, used strictly:

| Code | When |
|---|---|
| 200 | successful read or update |
| 201 | resource created |
| 204 | successful delete, no body |
| 400 | the request is malformed or fails validation |
| 401 | no token, malformed token, or expired token |
| 403 | valid token, but not allowed to perform this action |
| 404 | not found — **also for another user's resource** |
| 409 | conflict with current state (paying a closed loan, duplicate category) |
| 429 | too many failed login attempts (D-016, 2026-09-02) |
| 500 | unhandled — must never be reachable through the UI |

**Failed logins are rate limited** (added by D-016, 2026-09-02 — owner's
decision, after a load run measured the cost of leaving them unlimited). After
5 failures inside a 15-minute window, `POST /api/auth/login` answers 429 with a
`Retry-After` header until the window expires. Counted independently against the
e-mail being tried and against the client IP, whichever trips first; a
successful login clears both. The check happens *before* the password is
hashed — that is the point of it. Limits are configurable through
`LOGIN_MAX_FAILURES` and `LOGIN_WINDOW_MS`.

### Endpoints

```
GET    /api/health
   → 200 { "status": "ok", "version": "1.0.0", "db": "ok" }
   No auth. Must not touch user data.

POST   /api/auth/register   { email, password }        → 201 { token }
POST   /api/auth/login      { email, password }        → 200 { token }  | 401

GET    /api/categories                                  → 200 [ {id, name, icon} ]
POST   /api/categories      { name, icon }              → 201 { … } | 409 duplicate

POST   /api/transactions    { amount_cents, category_id, spent_on?, note? }
   → 201 { id, amount_cents, category_id, spent_on, note, created_at }
   spent_on defaults to today.
   Optional header Idempotency-Key (D-035): spent_on becomes required; the same
   key and payload replays the original 201 with Idempotency-Replayed: true;
   a different payload is 409 IDEMPOTENCY_CONFLICT; a deleted expense is 409
   IDEMPOTENCY_REPLAY_UNAVAILABLE. Without the header nothing changes.

GET    /api/ai/capabilities                             → 200 { enabled, mode, … }
POST   /api/ai/expense-draft { text, reference_date, locale?, consent_to_external_processing? }
   → 200 { request_id, status, draft, provenance, issues, versions }
   Added by D-033. Returns a DRAFT only and never writes a financial record.
   Errors 400 · 401 · 403 · 413 · 422 · 429 · 502 · 503 · 504 as defined in
   spec/ai-expense-entry.md §4.3, in the same {error:{code,message}} shape.

Any route: a JSON body over the parser limit is 413 PAYLOAD_TOO_LARGE (S23,
closing BUG-019), never a 500.

GET    /api/transactions?from=&to=&category_id=&limit=&offset=
   → 200 { "items": [ … ], "total": 123 }
   Defaults: current month, limit 50, max limit 200.

PATCH  /api/transactions/:id  { amount_cents?, category_id?, spent_on?, note? }
   → 200 { id, amount_cents, category_id, spent_on, note, created_at }
   → 400 | 404
   Added by D-029, closing the gap between §6.4 and this section. Partial:
   only the fields sent are changed, and at least one must be sent — an empty
   body is 400, not a 200 that did nothing. Server-owned fields (id,
   schedule_id, created_at) are REJECTED with 400, never silently ignored.

DELETE /api/transactions/:id                            → 204 | 404

GET    /api/settings                                    → 200 { monthly_income_cents }
PUT    /api/settings        { monthly_income_cents }    → 200 { … }
   Added by D-021. Zero means "not set" and the UI simply asks for it.

GET    /api/summary?month=YYYY-MM
   → 200 {
       "month": "2026-08",
       "total_cents": 64000,
       "income_cents": 150000,
       "remaining_cents": 86000,
       "by_category": [ { "category_id": 1, "name": "Groceries", "total_cents": 21000 } ]
     }
   income_cents and remaining_cents added by D-021. remaining_cents is
   income_cents - total_cents and may be negative — spending more than you
   earned is a fact, not an error.

POST   /api/schedules   { name, amount_cents, category_id, day_of_month, starts_on, total_count? }
   → 201 { … , "next_due": "2026-09-12", "remaining_count": 7 }

GET    /api/schedules?active=1
   → 200 [ { id, name, amount_cents, day_of_month, next_due,
              total_count, paid_count, remaining_count, remaining_cents, active } ]
   Sorted by next_due ascending. remaining_* are null for subscriptions.

PATCH  /api/schedules/:id  { name?, amount_cents?, category_id?,
                             day_of_month?, starts_on?, total_count? }
   → 200 { … the same shape POST returns }
   → 400 | 404 | 409
   Added by D-029. Same partial rules as transactions. paid_count and active
   are server-owned and are REJECTED with 400 — a counter that can be set by
   hand is a counter that can disagree with the rows it summarises.
   409 when total_count would fall BELOW paid_count: every field is a valid
   integer, so it is a conflict with the row's state, not bad input. Setting
   total_count EQUAL to paid_count is allowed and finishes the loan — the same
   arrow the last payment takes, reached from the other direction.

PATCH  /api/schedules/:id/pay
   → 200 { "paid_count": 8, "remaining_count": 2, "finished": false, "transaction_id": 41 }
   → 409 if the schedule is inactive
```

`next_due`, `remaining_count` and `remaining_cents` are **computed on read, never
stored.** Stored derived values go stale; that is a bug class worth avoiding by
design.

## 6. UI

Four screens, mobile-first, one HTML file each or one page with tabs — either is
fine. Bottom navigation, thumb-reachable.

**The interface is in English, and money is formatted `€12.50`** — symbol first,
point for the decimal, comma for thousands (D-018 and D-019, 2026-09-02,
owner's decision). This section's examples were originally Slovak (`Zaplatiť`,
`Je to pôžička`, `zostáva 7 z 10`, `15,00 €`), which reversed D-008; they are
rewritten below rather than left contradicting the code.

### 6.1 Add (the default screen)

Big amount display, a numeric keypad drawn in HTML (not `<input type=number>` —
the phone keyboard is worse than a custom keypad here), a grid of category tiles
with emoji, a Save button. **Two taps and a Save.**

An optional one-line note (D-020, 2026-09-02), saved to `transactions.note`,
which has existed in §3 all along. It sits last so the two taps and the Save
keep their positions. Categories are drawn as full-width rows rather than
squares (D-023) so a long name is not truncated.

A secondary **Describe an expense** button (D-033) opens a dialog: description,
suggested amount / category / date / note to check and correct, and **Save
expense**. It is hidden when the feature is off and never replaces the keypad.

### 6.2 This month

Total at the top. Below it a list grouped by day, newest first. Below that, one
horizontal bar per category showing its share of the month.

Above the total, a donut (D-022): one arc per category in its own colour, plus
the unspent part of the income in grey. Drawn as SVG with `stroke-dasharray`,
no library. Beside it, income and what remains, with the income editable in
place (D-021).

The bars stay. A donut shows the month against the income; the bars rank
categories against each other. Same numbers, different question.

Tapping a row opens it for editing — amount, category, date, note (D-029). The
delete control stays where it is; editing is a second thing a row can do, not a
replacement for the first.

### 6.3 Upcoming

Every active schedule, sorted by next charge date:

```
12 Sep   Telekom            €15.00
20 Sep   Laptop loan        €100.00   ·  7 of 10 left  ·  €700.00
```

Each row has a **Pay** button → `PATCH /pay`. When a loan finishes, show a
clear finished state.

### 6.4 Schedules

Add or edit. A single form; the only branch is a checkbox **"This is a loan"**
which reveals the `total_count` field. That checkbox is the entire difference
between a subscription and a loan in the UI.

### 6.5 `data-testid` convention

Every interactive or asserted element gets one. Kebab-case, stable, never
generated from text:

```
amount-display        keypad-1 … keypad-0     keypad-clear
category-tile-{id}    expense-save-btn
month-total           tx-row-{id}             tx-delete-{id}
category-bar-{id}
schedule-row-{id}     schedule-pay-{id}       schedule-next-due-{id}
schedule-remaining-{id}
nav-add  nav-month  nav-upcoming  nav-schedules
toast-success  toast-error
```

## 7. REPO

```
wallet/
├── package.json
├── .env.example          # JWT_SECRET=, PORT=3000, DB_PATH=./data/wallet.db
├── .gitignore            # node_modules, .env, data/*.db
├── README.md
├── src/
│   ├── server.js         # express app, middleware, error handler
│   ├── db.js             # better-sqlite3 connection + migrations
│   ├── schema.sql
│   ├── auth.js           # register, login, bearer middleware
│   ├── dates.js          # nextDue, clampToMonth, daysInMonth  ← pure functions
│   └── routes/
│       ├── transactions.js
│       ├── schedules.js
│       ├── categories.js
│       └── summary.js
└── public/
    ├── index.html
    ├── app.js
    ├── style.css
    └── manifest.json     # so it can be added to the home screen
```

**`src/dates.js` holds pure functions with no I/O.** Keep it that way — it is the
part with real logic and the part most worth testing later.

## 8. BUILD ORDER

### Session 1 — the spine
Project skeleton, `schema.sql`, `db.js`, `server.js`, `/api/health`, register and
login, bearer middleware.
**Done when:** `curl /api/health` returns 200, and a request without a token
returns 401 with the standard error shape.

### Session 2 — expenses
Categories (seed ~10 with emoji), `POST` and `GET /transactions`, `DELETE`,
`/summary`. All validation from §4.3.
**Done when:** an expense can be created and read back through the API, another
user's row returns 404, and an invalid amount returns 400.

### Session 3 — schedules and loans
`dates.js` with `nextDue` matching the table in §4.1 exactly. Schedules CRUD,
`PATCH /pay`, the loan countdown, the 409 on an inactive schedule.
**Done when:** a schedule set to the 31st returns 28 February as `next_due`, and
a 10-instalment loan closes itself on the tenth payment.

### Session 4 — the screens
Four screens, bottom navigation, every `data-testid` from §6.5, `manifest.json`,
mobile-first CSS.
**Done when:** an expense can be added on a phone in two taps and a save, and it
appears in "This month" with the total updated.

## 9. WHAT NOT TO BUILD

Not now, and not "quickly while we're here":

- budgets, limits or warnings
- multiple currencies
- CSV/PDF export
- offline sync, service workers
- dark mode
- password reset, e-mail sending, OAuth
- Docker
- any notification delivery — that is a later, separate piece of work
- for the optional description entry (D-033): receipt photos/OCR, voice, several
  expenses from one sentence, currency conversion, income or schedules created
  from text, access to history, tools or any action taken by the model itself

**Charts and income are no longer on this list either** (D-022 and D-021,
2026-09-02 — owner's decision). Two lines were removed: "charts or a charting
library — bars are `<div>`s with a width percentage" and "income, balances, or
account reconciliation".

What replaced them is narrower than what was excluded. The chart is a donut
drawn by hand in SVG — the objection was to pulling in a charting library, and
§2's four dependencies still stand. Income is **one figure** and one
subtraction: no balance carried between months, no reconciliation against a real
account, no second money-in concept. Budgets, limits and warnings remain
excluded, and they are the thing the income line was protecting against.

**Tests and CI are no longer on this list** (D-010, 2026-09-02 — owner's
decision). The line above originally read "Docker, CI, tests — a separate
project handles the testing layer"; Docker remains excluded, tests and CI do
not. The test layer lives in `qa/` in this repository and is built after the
four sessions in §8. Its tooling is dev-only and does not count against the four
application dependencies in §2.

If a feature is not in §1, it is out.

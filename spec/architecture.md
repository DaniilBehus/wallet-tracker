# Wallet Tracker — architecture and development notes

## 1. Product and scope

Wallet Tracker is a phone-first web application for recording expenses,
recurring charges and loans. An expense has already happened; a recurring
charge will happen again; a loan is a recurring charge with a finite number of
instalments. This keeps the domain deliberately small while supporting the
main financial flows.

The optional **Describe an expense** flow accepts one short sentence and
returns an editable draft. It never saves a financial record automatically:
the user reviews the draft and uses the ordinary Save action. Its detailed
contract is in [`ai-expense-entry.md`](ai-expense-entry.md).

## 2. Architecture

| Area | Choice | Rationale |
|---|---|---|
| Runtime | Node.js 20+ with Express | Small, direct HTTP application with no build step |
| Storage | SQLite through `better-sqlite3` | A single local database file suits a single-user app |
| Authentication | JWT with HS256 | Stateless bearer authentication; the signing secret is configured outside Git |
| Password storage | bcrypt | Passwords are never stored as plain text |
| Frontend | Plain HTML, CSS and JavaScript | Fast mobile interface without framework overhead |
| Money | Integer cents | Avoids floating-point rounding errors in financial totals |

The server has no float arithmetic or currency formatting. Amounts are stored
as `amount_cents`; presentation formatting happens only at the browser edge.

Dates are local calendar dates (`YYYY-MM-DD`) with no timezone conversion. The
product models personal spending rather than cross-timezone accounting.

## 3. Data model and invariants

| Table | Responsibility | Important invariants |
|---|---|---|
| `users` | Account identity | Unique email; password hash only |
| `categories` | Per-user expense categories | A category name is unique for its owner |
| `transactions` | Expenses that happened | Positive integer cents; optional source schedule |
| `schedules` | Future recurring charges and loans | Positive amount, valid day of month, active state and payment count |
| `settings` | Per-user monthly income | At most one row per user; non-negative cents |

A loan is represented by a schedule with `total_count`; a subscription has
`total_count = NULL`. `remaining_count`, `remaining_cents` and `next_due` are
computed on read instead of stored, preventing derived data from becoming
stale.

For a schedule due on a day that does not exist in a month, the date is clamped
to the last day of that month. A schedule set to the 31st therefore runs on
February 28th (or 29th in a leap year), rather than disappearing for a month.

Paying a schedule creates one transaction and increments `paid_count`. A loan
becomes inactive when its count reaches `total_count`; an attempt to pay an
inactive schedule returns a conflict.

## 4. API design

The API is rooted at `/api`, accepts JSON and returns JSON. Except for health
and authentication endpoints, every route requires `Authorization: Bearer
<token>`.

Every error has one stable shape:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "amount_cents must be a positive integer" } }
```

| Area | Routes and behaviour |
|---|---|
| Health | `GET /health` verifies service and database availability without reading user data |
| Authentication | Register and login issue JWTs; failed logins are rate-limited before password hashing |
| Categories | List and create per-user categories; another user's resource is reported as `404` |
| Transactions | Create, filter, update with `PATCH`, and delete expenses; server-owned fields are rejected on update |
| Idempotency | `POST /transactions` can use `Idempotency-Key` to replay the original successful create safely; conflicting payloads are rejected |
| Settings and summary | Store monthly income and calculate monthly totals, category shares and remaining income |
| Schedules | Create, list, update and pay recurring charges or loans; schedule state is validated atomically |
| AI draft | Capabilities plus an expense-draft endpoint that returns a validated draft only |

Validation rejects malformed input with `400`, uses `401` for missing or
invalid authentication, `404` for unavailable resources, `409` for a conflict
with current state, and `429` for throttled failed logins. Oversized JSON is a
`413`, never an unhandled server error.

Transactions and schedules support partial `PATCH` updates. An empty update is
rejected, and server-owned state such as identifiers, timestamps, `paid_count`
and `active` cannot be set by a client.

## 5. Interface and interaction design

The product has four mobile-first screens:

- **Add:** a custom numeric keypad, category selection and a save action; an
  optional note remains secondary to the quick expense flow.
- **This month:** totals, category shares, income and remaining income, with
  transactions grouped by day and editable in place.
- **Upcoming:** active schedules ordered by next charge date, including loan
  progress and a Pay action.
- **Schedules:** one form for recurring charges and loans; a loan is selected
  explicitly and reveals its instalment count.

Every interactive or asserted element has a stable `data-testid`. Tests use
these semantic identifiers or accessible roles rather than fragile visual CSS
selectors. The interface is English and formats money as `€12.50`.

## 6. Quality strategy

The repository treats testing as part of the product:

| Layer | Purpose |
|---|---|
| API contract checks | Validate status codes, schemas, authentication and error paths |
| Python scenarios | Exercise the API as an independent client and produce JUnit-compatible output |
| Playwright | Cover key user journeys in phone and desktop viewports |
| Race checks | Exercise concurrent writes against one SQLite file |
| Load checks | Measure write contention and failed-login rate limiting |
| AI evaluation | Evaluate offline-labelled sentence-to-draft behaviour without requiring a provider call |
| Self-check gate | Enforce selected source, route, test-id and coverage invariants |

The checksum gate records this architecture document deliberately. It protects
important product assumptions from unnoticed changes; an intentional edit must
update the recorded SHA-256 value in the same review.

## 7. Deliberate limits

Wallet Tracker is intentionally not a banking or accounting platform. It does
not include multiple currencies, account reconciliation, budget alerts,
offline sync, notifications, password reset, OAuth, CSV/PDF export, Docker or
a framework-based frontend.

The optional AI flow does not process receipt photos, voice input, multiple
expenses from one sentence, historical data, external tools or autonomous
actions. It proposes an editable draft only.

# SQL diagnostics

[← Support pack](README.md) · [Runbook](runbook.md)

Read-only queries for the questions support is asked most often, each with its
purpose, parameters and the shape of a healthy answer. They run against the
application's SQLite database (`DB_PATH`, `./data/wallet.db` by default) while
the app keeps running: the database is in WAL mode, so a reader never blocks it.

`qa/python/test_sql_diagnostics.py` runs every query on this page — the text of
the blocks below, not a copy — against a database the real app wrote, on a
connection that cannot write, and checks each one returns exactly the columns
listed here and agrees with the API where the API answers the same question.

## Rules

- **Open the database read-only.** Every query here is a `SELECT`, but the
  connection is what guarantees nothing changes. The helper below opens it with
  `readonly: true`; a stray `UPDATE` then fails instead of running.
- **Never select `users.password_hash` or `transaction_requests.response_json`.**
  The second one stores the whole saved expense, note included.
- **Cite ids, not content.** A ticket needs `user_id 7, schedule_id 3`, not the
  person's e-mail or what they called their loan.
- Money is in cents: `1250` is €12.50. Dates are local `YYYY-MM-DD` strings.

## Running a query

Save the query in a file (say `query.sql`), then run it with the Node helper
below, from the application folder. Node is always there because the app runs
on it; the helper uses the app's own SQLite driver.

Windows PowerShell:

```powershell
@'
const Database = require(require.resolve('better-sqlite3', { paths: [process.cwd()] }));
const db = new Database(process.argv[2], { readonly: true, fileMustExist: true });
const params = Object.fromEntries(process.argv.slice(4).map((a) => a.split(/=(.*)/s).slice(0, 2)));
console.table(db.prepare(require('fs').readFileSync(process.argv[3], 'utf8')).all(params));
'@ | Set-Content -Encoding utf8 "$env:TEMP\wallet-query.js"
node "$env:TEMP\wallet-query.js" data\wallet.db query.sql user_id=7 month=2026-09
```

Linux or macOS shell:

```bash
cat > /tmp/wallet-query.js <<'JS'
const Database = require(require.resolve('better-sqlite3', { paths: [process.cwd()] }));
const db = new Database(process.argv[2], { readonly: true, fileMustExist: true });
const params = Object.fromEntries(process.argv.slice(4).map((a) => a.split(/=(.*)/s).slice(0, 2)));
console.table(db.prepare(require('fs').readFileSync(process.argv[3], 'utf8')).all(params));
JS
node /tmp/wallet-query.js data/wallet.db query.sql user_id=7 month=2026-09
```

Parameters are `name=value` pairs matching the `:name` placeholders; values
arrive as text, which SQLite compares correctly with the integer id columns.

## Queries

### Q0 · Find a person's user id

Every other query takes a `user_id`. People identify themselves by e-mail, so
this is the one place an address is typed; registration stores it trimmed and
lower-cased, and so does the lookup. (SQLite's `lower()` covers ASCII only: an
address with non-ASCII letters must be typed exactly as stored.)

```sql
-- query: user-id
-- params: email
-- returns: user_id, created_at
SELECT id AS user_id, created_at
FROM users
WHERE email = lower(trim(:email));
```

**Shape:** one row, or none when no account uses that address. `created_at` is
UTC (`YYYY-MM-DD HH:MM:SS`).

### Q1 · A month's total, to compare with the summary

When the month screen shows a total the person does not believe, this is the
same sum `GET /api/summary?month=YYYY-MM` returns as `total_cents`.

```sql
-- query: month-total
-- params: user_id, month
-- returns: total_cents, expense_rows
SELECT COALESCE(SUM(amount_cents), 0) AS total_cents,
       COUNT(*) AS expense_rows
FROM transactions
WHERE user_id = :user_id
  AND spent_on >= :month || '-01'
  AND spent_on <= :month || '-31';
```

**Shape:** exactly one row; `total_cents` 0 and `expense_rows` 0 for an empty
month. If `total_cents` differs from the summary's, the summary is wrong and
that is a defect to escalate. If they agree, the data is what the screen shows,
and the question becomes which expense the person did not expect: list them
with the API (`GET /api/transactions?from=…&to=…`) rather than by hand here.

### Q2 · The limit, and the state the summary derives from it

The month screen judges spending against the limit in four states. This query
applies the same rules as `limitState` in `src/settings.js`, so its
`limit_status` must equal the summary's.

```sql
-- query: limit-state
-- params: user_id, month
-- returns: settings_row, limit_cents, total_cents, limit_status
SELECT CASE WHEN s.user_id IS NULL THEN 0 ELSE 1 END AS settings_row,
       s.monthly_limit_cents AS limit_cents,
       t.total_cents,
       CASE
         WHEN s.monthly_limit_cents IS NULL THEN 'not_set'
         WHEN t.total_cents < s.monthly_limit_cents THEN 'within'
         WHEN t.total_cents = s.monthly_limit_cents THEN 'reached'
         ELSE 'exceeded'
       END AS limit_status
FROM (SELECT COALESCE(SUM(amount_cents), 0) AS total_cents
      FROM transactions
      WHERE user_id = :user_id
        AND spent_on >= :month || '-01'
        AND spent_on <= :month || '-31') AS t
LEFT JOIN settings AS s ON s.user_id = :user_id;
```

**Shape:** exactly one row. Read `limit_cents` carefully — three different
things look alike:

| `settings_row` | `limit_cents` | Meaning |
|---|---|---|
| 0 | NULL | The person never saved an income or a limit. The API reports income 0 and no limit. |
| 1 | NULL | A settings row exists, but no limit is set: `not_set`, not zero. |
| 1 | 0 | A real limit of nothing. With no spending the month is already `reached`, and any expense makes it `exceeded`. |

Spending exactly the limit is `reached`, not `exceeded`. A limit never blocks a
save, so "I could not save because of my limit" is a different problem.

### Q3 · Scheduled payments: presses of Pay against the expenses they wrote

`paid_count` goes up by one each time somebody presses **Pay**, and that press
writes one expense carrying the schedule's id. Wallet never pays by itself: a
payment nobody pressed was never made.

```sql
-- query: schedule-payments
-- params: user_id
-- returns: schedule_id, name, total_count, paid_count, active, linked_expenses, unlinked_payments
SELECT s.id AS schedule_id,
       s.name,
       s.total_count,
       s.paid_count,
       s.active,
       COUNT(t.id) AS linked_expenses,
       s.paid_count - COUNT(t.id) AS unlinked_payments
FROM schedules AS s
LEFT JOIN transactions AS t ON t.schedule_id = s.id AND t.user_id = s.user_id
WHERE s.user_id = :user_id
GROUP BY s.id
ORDER BY s.id;
```

**Shape:** one row per schedule. `total_count` NULL is a subscription; a number
is a loan of that many instalments, and `active` 0 means it is finished.

- `unlinked_payments` 0: every press of Pay still has its expense.
- `unlinked_payments` above 0: the person deleted an expense a payment wrote.
  The count stays on purpose — the payment happened — so this is explained, not
  broken. It is also why a month can show fewer instalments than were paid.
- `unlinked_payments` below 0: more expenses point at the schedule than it was
  ever paid. That should not be possible; escalate it.

`name` is the person's own text. Use it to find the schedule they mean, then
cite `schedule_id`.

### Q4 · Keyed saves and their tombstones

A save sent with an `Idempotency-Key` (the AI review screen does this) is
recorded once per key. A retry of the same key is answered from that record —
the response carries `Idempotency-Replayed: true` — and adds no new row, so the
database shows which keys exist, not how often each was retried.

```sql
-- query: keyed-saves
-- params: user_id
-- returns: operation_key, transaction_id, created_at, state
SELECT r.operation_key,
       r.transaction_id,
       r.created_at,
       CASE WHEN t.id IS NULL THEN 'tombstone' ELSE 'live' END AS state
FROM transaction_requests AS r
LEFT JOIN transactions AS t ON t.id = r.transaction_id
WHERE r.user_id = :user_id
ORDER BY r.created_at DESC, r.operation_key;
```

**Shape:** one row per key. `live` means the expense still exists. `tombstone`
means it was deleted afterwards and the record stayed, deliberately: a late
retry of that key then answers 409 instead of bringing the expense back. So "I
pressed save again and got a conflict" after a delete is the design working.

### Q5 · Today's AI quota use

The AI draft is capped per day, for everyone together and for each person.
Every attempt that reaches the provider takes a place, including one that
failed; that is what stops a broken provider from being retried without end.

```sql
-- query: ai-quota-today
-- params: user_id, day
-- returns: scope, count
SELECT scope, count
FROM ai_quota
WHERE period = :day
  AND ((scope = 'global-day' AND user_id = 0)
    OR (scope = 'user-day' AND user_id = :user_id))
ORDER BY scope;
```

`day` is the server's local date, `YYYY-MM-DD`.

**Shape:** up to two rows. `global-day` is everyone together, against
`WALLET_AI_GLOBAL_DAILY_CALLS` (20 by default); `user-day` is this person,
against `WALLET_AI_USER_DAILY_CALLS` (5 by default). No row means no attempt
today. A count at its limit explains `429` on the draft; with AI switched off
nothing is ever counted, and the draft answers `503` instead.

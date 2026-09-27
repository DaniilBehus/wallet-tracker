# Runbook

[← Support pack](README.md) · [SQL diagnostics](sql-diagnostics.md) · [Incidents](incidents/)

How to run Wallet, where its logs go, how to find the one request a person is
asking about, and what to check for the problems people actually report. Wallet
is a personal project: one Node.js process and one SQLite file. There is no
on-call rota, no uptime promise and no production traffic behind this page.

Every command here was run once, on 2026-09-27, against local servers with
disposable databases, and every output block is copied from those runs. Their
logs went to a temporary folder rather than `data/`; the commands were otherwise
as printed. The Linux commands ran in Git Bash on Windows. Ctrl+C was not
pressed in an interactive terminal; the server was stopped by ending its
process, which has the same effect.

## 1. Start and stop

Needs Node.js 22+, `npm ci` once, and a `.env` copied from `.env.example` with
`JWT_SECRET` set. The settings that matter to support:

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | Where the app listens |
| `DB_PATH` | `./data/wallet.db` | The SQLite file |
| `WALLET_AI_MODE` | `off` | `off` or `live`; see [AI draft unavailable](#53-ai-draft-unavailable) |
| `WALLET_REQUEST_LOG` | on | `off` silences the per-request lines, never the error lines |

Start it in the foreground with its output going to a log file. `data/` already
holds the database and is ignored by git.

Windows PowerShell:

```powershell
cmd /c "npm start > data\wallet.log 2>&1"
```

`cmd /c` is deliberate: Windows PowerShell 5.1 turns every line a program writes
to stderr into an error record, which breaks the JSON lines; `cmd` writes them as
they are.

Linux shell:

```bash
npm start >> data/wallet.log 2>&1
```

Follow the log from a second terminal — PowerShell `Get-Content data\wallet.log
-Wait -Tail 20`, Linux `tail -f data/wallet.log`. The first lines are npm's and
the app's own; after them, one JSON line per request. From the local run (the
`.env` line appears because that run set its variables in the shell instead):

```text
> wallet@1.0.0 start
> node --env-file-if-exists=.env src/server.js

.env not found. Continuing without it.
wallet 1.0.0 listening on http://localhost:3041
{"time":"2026-09-27T11:29:02.574Z","level":"info","event":"request","request_id":"55a246a9-edc1-411d-91b0-d4b8461899e0","method":"GET","route":"/api/health","status":200,"duration_ms":5.9,"user_id":null}
```

**Stop:** Ctrl+C in the terminal that started it. If you cannot reach that
terminal, stop whatever listens on the port — PowerShell:

```powershell
Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000 -State Listen).OwningProcess
```

A restart clears every sign-in lockout, because those are held in memory.
Expenses, settings and the AI quota counters live in the database and survive
it.

## 2. Where the logs go

| Stream | Lines |
|---|---|
| stdout | One line per request, `"event":"request"`. One `"event":"ai_draft"` line per AI draft. |
| stderr | `"event":"UNHANDLED"` for an error the app did not expect, with code, message and stack. `[ai] …` warnings at start-up. |

The start commands above send both streams to the same file.

A request line carries `time` (UTC), `level`, `event`, `request_id`, `method`,
`route` — the pattern, such as `/api/transactions/:id`, never the address with
its ids or query — `status`, `duration_ms` and `user_id` (null when the request
was not signed in). The `ai_draft` line has no time of its own; its request line
sits next to it with the same id.

`duration_ms` counts time inside the app. A request that waited for a busy
process before it got there still shows a small number — in
[INC-002](incidents/INC-002.md) a health check took over a second and logged
0.2 ms. When "everything is slow", time a request from outside and compare it
with an idle moment measured the same way:

```bash
curl -s -o /dev/null -w '%{time_total}\n' http://localhost:3000/api/health
```

```text
0.002279
```

```powershell
(Measure-Command { Invoke-RestMethod http://localhost:3000/api/health }).TotalMilliseconds
```

```text
40,5507
```

curl prints seconds; PowerShell prints milliseconds, here with a decimal comma,
and about 40 of them are its own overhead, which is why the comparison is with
an idle measurement taken the same way.

**Never in the log:** e-mail addresses, passwords, tokens or the Authorization
header, notes, AI descriptions or answers, request bodies.
`qa/python/test_request_log.py` checks this against a real server's output.

## 3. Find one request by its reference

When the app refuses something, the error message has a line under it:
**Reference: 7e67d71b**. Those are the first eight characters of the request's
id, and every line about that request contains the full id.

PowerShell:

```powershell
Select-String -Path data\wallet.log -Pattern 366d57b2
```

Linux:

```bash
grep 366d57b2 data/wallet.log
```

Both printed the same line in the local run:

```text
{"time":"2026-09-27T11:26:58.780Z","level":"info","event":"request","request_id":"366d57b2-f90f-4ff1-b323-7310092a8197","method":"POST","route":"/api/auth/login","status":429,"duration_ms":1.1,"user_id":null}
```

A request can have more than one line — a 500 has an `UNHANDLED` line too, an AI
draft an `ai_draft` line. To read the fields of one, PowerShell can parse it:

```powershell
Select-String -Path data\wallet.log -Pattern 7e67d71b | ForEach-Object { $_.Line | ConvertFrom-Json } |
  Where-Object event -eq 'UNHANDLED' | Select-Object request_id, route, code, message
```

```text
request_id : 7e67d71b-88a3-46ca-aa08-c0b560a07ac5
route      : /api/transactions
code       : SQLITE_BUSY
message    : database is locked
```

## 4. Health check

```bash
curl -s http://localhost:3000/api/health
```

```text
{"status":"ok","version":"1.0.0","db":"ok"}
```

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

```text
status  : ok
version : 1.0.0
db      : ok
```

Read `db`, not only the status code: the endpoint answers 200 even when its
database query fails, and says so as `"db":"error"`. No answer at all means the
process is not running or not on that port.

## 5. Triage

Each branch: **symptom** as a person would say it, **check**, **likely cause**,
**action**, and **escalate** when support cannot close it. Escalations use the
[template](#6-escalation-template).

### 5.1 Cannot sign in, or "too many attempts"

- **Symptom:** "My password doesn't work." / "It says to try again later."
- **Check:** the reference, or the latest `/api/auth/login` lines. `401` is a
  refused e-mail or password: the message is the same for both, so the form
  never reveals which addresses have accounts. `429` is a lockout, answered with
  a `Retry-After` header in seconds.
  In the local run, five wrong passwords gave `401 401 401 401 401`; the sixth
  attempt and then the *correct* password both got:

  ```text
  {"error":{"code":"RATE_LIMITED","message":"Too many failed login attempts. Try again later."}}
  Retry-After: 900
  ```

  To see whether one person or many are affected, count the lockouts:

  ```powershell
  (Select-String -Path data\wallet.log -Pattern '"route":"/api/auth/login","status":429' -SimpleMatch).Count
  ```
  ```bash
  grep -c '"route":"/api/auth/login","status":429' data/wallet.log
  ```

  Both printed `2` in the local run: the sixth attempt and the correct password
  tried during the lockout.
- **Likely cause:** five failed attempts within 15 minutes. They count per
  e-mail *and* per network address, so people sharing one address can lock each
  other out.
- **Action:** wait for `Retry-After` to run out; during the lockout even the
  right password is refused. A successful sign-in clears the count. Restarting
  the server clears every lockout at once — only for a lockout that is hurting
  several people, since it also clears the protection. There is no password
  reset in Wallet: a forgotten password cannot be fixed by support.
- **Escalate:** many different people locked out at once, or a lockout nobody
  caused. Attach the counts and a few references.

### 5.2 A save returns 400, 409 or 500

- **Symptom:** "It won't save my expense."
- **Check:** the reference, then the status.

**400 — the input broke a rule.** The error names the rule:

```text
{"error":{"code":"VALIDATION_FAILED","message":"amount_cents must be a positive integer"}}
```

The screens check the common rules before sending, so a 400 from the app's own
screen, as opposed to a script calling the API, suggests the screen let
something through. **Action:** explain the rule. **Escalate** a 400 from the
app's own screen with its reference.

**409 — a conflict with what is already stored.** The cases, all by design:
the same `Idempotency-Key` sent with a different expense, as in the local run —

```text
{"error":{"code":"IDEMPOTENCY_CONFLICT","message":"This Idempotency-Key was already used for a different expense"}}
```

— a retry of a keyed save whose expense was deleted since (a tombstone, see
[Q4](sql-diagnostics.md#q4--keyed-saves-and-their-tombstones)), a category name
that already exists, paying a loan that is already closed, or lowering a loan's
instalment count below what is already paid. **Action:** explain; the screen
offers the next step. **Escalate** only a 409 none of these explains.

**500 — always a defect or an environment problem.** The error body never says
more than `Unexpected server error`; the log does. Find the `UNHANDLED` line by
reference (section 3). In the local run another connection held the database's
write lock, and the save failed after waiting out the 5-second busy timeout:

```text
{"time":"2026-09-27T11:27:04.989Z","level":"info","event":"request","request_id":"7e67d71b-88a3-46ca-aa08-c0b560a07ac5","method":"POST","route":"/api/transactions","status":500,"duration_ms":5514.5,"user_id":1}
```

`SQLITE_BUSY` means something else is writing to `wallet.db`: a database browser
left in the middle of a change, a backup tool, a second copy of the app on the
same file. **Action:** find and close the other writer; the save then works on
retry. **Escalate** any other code, and `SQLITE_BUSY` that returns with nothing
else open. Attach the `UNHANDLED` line's code, message, route and first stack
line. The request body is not in the log, and should not be pasted from
anywhere else either.

### 5.3 AI draft unavailable

- **Symptom:** "The AI button doesn't work." / "It says to enter the expense
  manually."
- **Check:** the reference: its request line has the status, its `ai_draft`
  line the outcome. `GET /api/ai/capabilities` says whether AI is on at all.
- **Causes, by outcome:**

| Status · outcome | Meaning | Action |
|---|---|---|
| 503 `AI_UNAVAILABLE` | AI is off (the default), or live mode was asked for and is not configured | Manual entry. If AI should be on, the start-up log names what is missing |
| 429 `AI_RATE_LIMITED` | A quota is spent: 3 drafts a minute and 5 a day per person, 20 a day for everyone, by default | Wait: the minute cap frees the next minute, the daily ones at local midnight. Check [Q5](sql-diagnostics.md#q5--todays-ai-quota-use) |
| 502 `AI_PROVIDER_FAILED`, `AI_INVALID_RESPONSE` · 503 `AI_PROVIDER_BUSY` · 504 `AI_TIMEOUT` | The AI provider failed, answered unusably, was busy, or was slow | Manual entry; try later |
| 403 `AI_CONSENT_REQUIRED` · 422 `AI_CONTEXT_TOO_LARGE` · 400 `REFERENCE_DATE_MISMATCH` | Consent not given; too many categories; the device's date is more than a day off the server's | Explain; for the date, check the phone's clock |

From the local run, AI off:

```text
{"event":"ai_draft","request_id":"c5bef1d4-5d6b-442a-87dd-a6c506c73b7b","outcome":"AI_UNAVAILABLE","ms":1,"versions":{"schema":"1","prompt":"1","normalizer":"2"},"usage":null}
{"time":"2026-09-27T11:27:06.088Z","level":"info","event":"request","request_id":"c5bef1d4-5d6b-442a-87dd-a6c506c73b7b","method":"POST","route":"/api/ai/expense-draft","status":503,"duration_ms":3.1,"user_id":1}
```

Live mode asked for without its settings, the first line at start-up:

```text
[ai] live mode requested but not enabled; missing: OPENAI_API_KEY, WALLET_AI_MODEL, WALLET_AI_LIVE_ALLOWED=true
```

A provider error, then the quota, from a run against the test suite's local
stand-in for the provider (no network, no key):

```text
{"event":"ai_draft","request_id":"d62b4adb-61a5-4c5a-bf8a-af325a29cecc","outcome":"AI_PROVIDER_FAILED","ms":45,"versions":{"schema":"1","prompt":"1","normalizer":"2"},"usage":null}
{"time":"2026-09-27T11:28:26.429Z","level":"info","event":"request","request_id":"d62b4adb-61a5-4c5a-bf8a-af325a29cecc","method":"POST","route":"/api/ai/expense-draft","status":502,"duration_ms":48.4,"user_id":1}
{"event":"ai_draft","request_id":"7a8b2e16-ec53-46be-8ded-03ff557dc2b4","outcome":"AI_RATE_LIMITED","ms":0,"versions":{"schema":"1","prompt":"1","normalizer":"2"},"usage":null}
{"time":"2026-09-27T11:28:26.465Z","level":"info","event":"request","request_id":"7a8b2e16-ec53-46be-8ded-03ff557dc2b4","method":"POST","route":"/api/ai/expense-draft","status":429,"duration_ms":1.4,"user_id":1}
```

That fourth draft within a minute was refused before any provider request. Q5
then counted three for the person and for everyone, the failed and the busy
attempt included:

```text
┌─────────┬──────────────┬───────┐
│ (index) │ scope        │ count │
├─────────┼──────────────┼───────┤
│ 0       │ 'global-day' │ 3     │
│ 1       │ 'user-day'   │ 3     │
└─────────┴──────────────┴───────┘
```

- **Escalate:** several provider errors in a row (an outage, or a wrong key or
  model), or the global count reaching its cap early in the day. Attach the
  outcomes and their times, never the description a person typed.

### 5.4 The limit figure looks wrong

- **Symptom:** "It says I'm over my limit, but I'm not."
- **Check:** run [Q1 and Q2](sql-diagnostics.md#q2--the-limit-and-the-state-the-summary-derives-from-it)
  for that person and month, and compare them with the month screen. From the
  local run:

  ```text
  ┌─────────┬──────────────┬─────────────┬─────────────┬──────────────┐
  │ (index) │ settings_row │ limit_cents │ total_cents │ limit_status │
  ├─────────┼──────────────┼─────────────┼─────────────┼──────────────┤
  │ 0       │ 1            │ 2500        │ 3500        │ 'exceeded'   │
  └─────────┴──────────────┴─────────────┴─────────────┴──────────────┘
  ```

  That month had been exactly at its limit, €25.00 of €25.00. Then two loan
  instalments were paid and one of their expenses deleted again: the payment
  that remains is a €10.00 expense dated that day, and it counts.
- **Likely cause:** almost always the data, not the arithmetic. A scheduled
  payment counts in the month Pay was pressed. An expense was saved with another
  day's date. The limit is 0, which is a real limit, rather than unset. Spending
  exactly the limit is *reached*, not over, though the frame around the figure
  turns red because nothing is left.
- **Action:** show the person which expenses make up the total; edit a wrongly
  dated one.
- **Escalate:** Q1 or Q2 disagreeing with the summary. That is a defect.

### 5.5 A scheduled payment is missing

- **Symptom:** "My loan payment didn't go through." / "Last month's
  subscription isn't there."
- **Check:** Wallet never pays by itself. A payment exists only when somebody
  pressed **Pay**, and the expense it writes is dated the day of the press, not
  the schedule's day. Run [Q3](sql-diagnostics.md#q3--scheduled-payments-presses-of-pay-against-the-expenses-they-wrote):

  ```text
  ┌─────────┬─────────────┬──────────┬─────────────┬────────────┬────────┬─────────────────┬───────────────────┐
  │ (index) │ schedule_id │ name     │ total_count │ paid_count │ active │ linked_expenses │ unlinked_payments │
  ├─────────┼─────────────┼──────────┼─────────────┼────────────┼────────┼─────────────────┼───────────────────┤
  │ 0       │ 1           │ 'Laptop' │ 3           │ 2          │ 1      │ 1               │ 1                 │
  └─────────┴─────────────┴──────────┴─────────────┴────────────┴────────┴─────────────────┴───────────────────┘
  ```

  Two presses of Pay, one expense: the person deleted the other afterwards. The
  presses themselves are in the log:

  ```powershell
  Select-String -Path data\wallet.log -Pattern '"route":"/api/schedules/:id/pay"' -SimpleMatch |
    ForEach-Object { $_.Line | ConvertFrom-Json } | Select-Object time, request_id, status, user_id
  ```

  ```text
  time                     request_id                           status user_id
  ----                     ----------                           ------ -------
  2026-09-27T11:27:06.495Z e07bb78e-0417-4b7c-b9e6-2b4b4008e426    200       1
  2026-09-27T11:27:06.497Z 2cd4c2c7-6e9b-49da-89a5-c19a42c1328f    200       1
  ```

  (`grep '"route":"/api/schedules/:id/pay"' data/wallet.log` gives the same two
  lines as raw JSON.)
- **Likely cause:** nobody pressed Pay; it was pressed in a later month; or the
  payment's expense was deleted afterwards.
- **Action:** to record a missed payment, press Pay (it writes today's date) or
  add the expense by hand with the right date.
- **Escalate:** `unlinked_payments` below zero, or a payment recorded twice with
  only one press in the log.

## 6. Escalation template

```text
Summary:      <one line: what the person cannot do>
Reported:     <date and time, and how>
Reference(s): <8-character references, or full request ids>
Account:      user_id <n>                      (never the e-mail or password)
Route/status: <e.g. POST /api/transactions · 500>
Checked:      <health result; log lines by reference; queries run and results>
Log lines:    <the request line; for a 500 the UNHANDLED code, message, route
               and first stack line>
Impact:       <one person or many; can they work around it?>
Workaround:   <what they are doing meanwhile, e.g. manual entry>
Suspected:    <cause, or "unknown">
```

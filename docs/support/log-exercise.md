# Log-reading exercise

[← Support pack](README.md) · [Runbook](runbook.md) · [SQL diagnostics](sql-diagnostics.md)

[`exercise.log`](exercise.log) is what Wallet printed during about thirteen
seconds of use: two accounts signing up, one of them setting a monthly limit,
saving expenses and paying a subscription — and three errors, each of a
different kind. Read it the way you would read the log of a server somebody has
asked you about, answer the three questions, then open the worked answer.

## How the log was made

`node scripts/support-exercise.js` starts the app on its own port with a
throwaway database, sends a short session of requests through the API and keeps
everything the server printed, in order. The requests came from the script; no
person used the app. The script chose every request, including the ones that
fail, and planted one failure from outside the app. The worked answer says which.

Two things differ from what the server printed: the app's own folder in the
stack trace is replaced by `<app>`, and the lines of the script's "is the server
up yet?" checks are left out. The run that wrote the committed file printed:

```text
wrote docs\support\exercise.log
planted failure: reference 53ab67f7 (53ab67f7-eeb1-4c9e-945f-03967cd6e392); the retry: e9bc4378-dbfa-4a19-8481-d9ed801fe685
```

Every run gives new ids and times, so regenerating the file means rewriting the
worked answer. The script uses port 3007; set `EXERCISE_PORT` to use another.

## The questions

1. **Reference `53ab67f7`.** Suppose a person sends you this reference from an
   error message. What were they doing, what went wrong and why? Did they lose
   anything, and what should support do?
2. **The sign-ins.** Something failed to sign in several times in a row. What
   happened, what did the app do about it — and what can this log *not* tell
   you?
3. **The AI entry.** One request to the AI entry failed. Is the AI feature
   broken?

Start from [section 3 of the runbook](runbook.md#3-find-one-request-by-its-reference):
every line about a request contains its full id. Run the commands from the
repository's root folder.

<details>
<summary><strong>Worked answer</strong></summary>

### 1. Reference 53ab67f7

**Find its lines.**

```powershell
Select-String -Path docs\support\exercise.log -Pattern 53ab67f7 | ForEach-Object { $_.Line | ConvertFrom-Json } |
  Select-Object event, route, status, duration_ms, user_id, code, message
```

```text
event       : UNHANDLED
route       : /api/transactions
status      :
duration_ms :
user_id     :
code        : SQLITE_BUSY
message     : database is locked

event       : request
route       : /api/transactions
status      : 500
duration_ms : 5551,4
user_id     : 1
code        :
message     :
```

PowerShell writes numbers the way the machine's language settings do, here
with a decimal comma. `grep 53ab67f7 docs/support/exercise.log` prints the same
two lines as they are in the file. The request line:

```text
{"time":"2026-09-27T11:45:16.439Z","level":"info","event":"request","request_id":"53ab67f7-eeb1-4c9e-945f-03967cd6e392","method":"POST","route":"/api/transactions","status":500,"duration_ms":5551.4,"user_id":1}
```

The `UNHANDLED` line is longer because it carries the stack.

**What they say.** `POST /api/transactions` saves an expense; user 1 sent it.
The app answered 500 after five and a half seconds, and the `UNHANDLED` line
with the same id gives the reason: `SQLITE_BUSY`, *database is locked*.

**Where it failed.** The first frame inside the app:

```powershell
Select-String -Path docs\support\exercise.log -Pattern 53ab67f7 | ForEach-Object { ($_.Line | ConvertFrom-Json).stack }
```

```text
SqliteError: database is locked
    at <app>\src\routes\transactions.js:113:6
    at Layer.handleRequest (<app>\node_modules\router\lib\layer.js:152:17)
    at next (<app>\node_modules\router\lib\route.js:157:13)
    at Route.dispatch (<app>\node_modules\router\lib\route.js:117:3)
    at handle (<app>\node_modules\router\index.js:435:11)
    at Layer.handleRequest (<app>\node_modules\router\lib\layer.js:152:17)
    at <app>\node_modules\router\index.js:295:15
    at processParams (<app>\node_modules\router\index.js:582:12)
    at next (<app>\node_modules\router\index.js:291:5)
    at router.handle (<app>\node_modules\router\index.js:186:3)
```

```bash
grep 53ab67f7 docs/support/exercise.log | grep -o 'src[a-z/\\]*\.js:[0-9:]*'
```

```text
src\\routes\\transactions.js:113:6
```

The backslashes are doubled because the stack is stored as JSON text. Line 113
of `src/routes/transactions.js` runs the `INSERT` that writes the expense.

**Why.** Look at the duration. The app waits up to 5 seconds for another writer
to finish before it gives up, and this request took a little over that: it
waited its turn and the turn never came. Something else was writing to the
database the whole time. Compare
[INC-001](incidents/INC-001.md#diagnosis), where the same `SQLITE_BUSY` came
after 1.4 ms: nothing waited there, and that is what made it a defect.

**What else did this person do?** Search by their user id instead of the
reference:

```powershell
Select-String -Path docs\support\exercise.log -Pattern '"user_id":1}' -SimpleMatch | ForEach-Object { $_.Line | ConvertFrom-Json } |
  Format-Table time, method, route, status, duration_ms
```

```text
time                     method route             status duration_ms
----                     ------ -----             ------ -----------
2026-09-27T11:45:06.340Z GET    /api/categories      200         2,2
2026-09-27T11:45:16.439Z POST   /api/transactions    500      5551,4
2026-09-27T11:45:17.956Z POST   /api/transactions    201         1,7
```

`grep '"user_id":1}' docs/support/exercise.log` gives the same three lines as
they are in the file. A second and a half after the failure the same person
saved an expense again, and it worked: `201` in 1.7 ms, reference `e9bc4378`.
By then the lock was gone.

**Did they lose anything?** The failed request stored nothing: the statement
the database refused is the one that writes the expense. Whether the `201` was
the same expense the log cannot say, because it holds no amounts or notes. The
person can, or the month's figures can
([Q1](sql-diagnostics.md#q1--a-months-total-to-compare-with-the-summary)):
the expense should be there once. In this run it was the same expense; the
script sent it again unchanged.

**What support does.** Tell the person the failed attempt saved nothing and
their second attempt saved the expense. Then look for the other writer:
`SQLITE_BUSY` after the full wait means something else was writing to
`wallet.db` — a database browser left in the middle of a change, a backup tool,
a second copy of the app on the same file
([runbook 5.2](runbook.md#52-a-save-returns-400-409-or-500)). Here it was the
planted failure: while the expense was being saved, the script held the
database's write lock from a second connection. If it comes back with nothing
else open, escalate with the `UNHANDLED` line's code, message, route and first
frame ([template](runbook.md#6-escalation-template)).

### 2. The sign-ins

```powershell
Select-String -Path docs\support\exercise.log -Pattern '"route":"/api/auth/login"' -SimpleMatch | ForEach-Object { $_.Line | ConvertFrom-Json } |
  Format-Table time, status, duration_ms, user_id
```

```text
time                     status duration_ms user_id
----                     ------ ----------- -------
2026-09-27T11:45:07.970Z    401        63,6
2026-09-27T11:45:08.392Z    401        63,3
2026-09-27T11:45:08.814Z    401        63,1
2026-09-27T11:45:09.235Z    401        62,1
2026-09-27T11:45:09.659Z    401        62,2
2026-09-27T11:45:10.019Z    429         0,6
```

```bash
grep '"route":"/api/auth/login"' docs/support/exercise.log
```

```text
{"time":"2026-09-27T11:45:07.970Z","level":"info","event":"request","request_id":"e6f107af-ff7d-403c-bc1d-c2446eabd2b1","method":"POST","route":"/api/auth/login","status":401,"duration_ms":63.6,"user_id":null}
{"time":"2026-09-27T11:45:08.392Z","level":"info","event":"request","request_id":"d7f34680-4f37-40fc-882c-978c179f81ed","method":"POST","route":"/api/auth/login","status":401,"duration_ms":63.3,"user_id":null}
{"time":"2026-09-27T11:45:08.814Z","level":"info","event":"request","request_id":"c6c95f61-bb90-4041-affc-616bf3767db6","method":"POST","route":"/api/auth/login","status":401,"duration_ms":63.1,"user_id":null}
{"time":"2026-09-27T11:45:09.235Z","level":"info","event":"request","request_id":"cff257bc-878f-431e-b0e0-ae22f79ef030","method":"POST","route":"/api/auth/login","status":401,"duration_ms":62.1,"user_id":null}
{"time":"2026-09-27T11:45:09.659Z","level":"info","event":"request","request_id":"98e515e7-d1b1-426b-a7f5-298bb57b88eb","method":"POST","route":"/api/auth/login","status":401,"duration_ms":62.2,"user_id":null}
{"time":"2026-09-27T11:45:10.019Z","level":"info","event":"request","request_id":"fe2d89d7-b196-4511-a3f3-45fb94428ca4","method":"POST","route":"/api/auth/login","status":429,"duration_ms":0.6,"user_id":null}
```

**What happened.** Five refused sign-ins, `401`, about 0.4 s apart, each taking
about 63 ms, which is how long one password check takes. The sixth was refused
with `429` in 0.6 ms, so no password was checked at all. That is the login
limiter: after five failures within 15 minutes it refuses further attempts
before looking at the password, and the response's `Retry-After` header says
how many seconds to wait
([runbook 5.1](runbook.md#51-cannot-sign-in-or-too-many-attempts)). Until then
even the right password is refused.

**What the log cannot tell you.** Whose address was tried: the lines carry no
e-mail, by design, and `user_id` is null on every sign-in line, successful or
not, because nobody is signed in until one succeeds. Nor where the attempts came
from: the log keeps no network addresses. So it cannot say whether this was the
account's owner mistyping, somebody guessing, or several people behind one
network address, or whether the lockout is on an e-mail or on an address — both
are counted. A person who says "it told me to try again later, at about a
quarter to twelve UTC" can be matched to these lines; the lines cannot be
matched to a person.

**Is it connected to reference 53ab67f7?** The lockout came less than a second
before that save began, and it was the same person's address: the script behind
this log tried user 1's. The log alone could not have shown you that, and the
two are still unrelated. The save came from someone already signed in, whose
token was accepted; it failed in the database, not at sign-in. A lockout stops
new sign-ins and signs nobody out, which is why user 1's retry at 11:45:17.956
worked inside the lockout's 15 minutes. Close in time is not the same cause.

### 3. The AI entry

The only request line on `/api/ai/expense-draft` has the id `6e32b881…`, and
that id finds a second line:

```powershell
Select-String -Path docs\support\exercise.log -Pattern 6e32b881 | ForEach-Object Line
```

```bash
grep 6e32b881 docs/support/exercise.log
```

Both print:

```text
{"event":"ai_draft","request_id":"6e32b881-00ae-46c1-ba42-4af2ccba51dc","outcome":"AI_UNAVAILABLE","ms":1,"versions":{"schema":"1","prompt":"1","normalizer":"2"},"usage":null}
{"time":"2026-09-27T11:45:18.362Z","level":"info","event":"request","request_id":"6e32b881-00ae-46c1-ba42-4af2ccba51dc","method":"POST","route":"/api/ai/expense-draft","status":503,"duration_ms":2,"user_id":2}
```

**What they say.** The request line alone: `503` from the AI entry, user 2, in
2 ms. The `ai_draft` line, which has no time of its own, gives the outcome:
`AI_UNAVAILABLE`, decided in 1 ms, with `usage` null. No AI provider was asked
anything; nothing left the server. What the person typed is in neither line,
by design.

**Broken, or off?** The [runbook's table](runbook.md#53-ai-draft-unavailable)
tells them apart by code. A spent quota is `429 AI_RATE_LIMITED`; a failing
provider is a `502`, `503` or `504` with a code of its own, and it takes as long
as the provider does. `AI_UNAVAILABLE` means the AI is switched off, which is
the default, or live mode was asked for and is not configured. The start of the
log decides between those two: live mode missing its settings prints an
`[ai] live mode requested but not enabled; missing: …` line at start-up, and
there is none.

```powershell
(Select-String -Path docs\support\exercise.log -Pattern '[ai]' -SimpleMatch).Count
```

```bash
grep -c '\[ai\]' docs/support/exercise.log
```

Both print `0`. The AI entry is switched off on this server; the script started
it with `WALLET_AI_MODE=off`. There is nothing to fix. The person can enter the
expense by hand, and whether the AI should be on is a decision for whoever runs
the server, not a defect.

</details>

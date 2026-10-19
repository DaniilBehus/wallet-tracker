# Defect register

<!-- F20-F21 current-status notice begin -->
> **Current-state pointer (2026-10-13):** this register preserves original
> findings, Fix-cell wording and dated run evidence. Read the
> [current QA status](../docs/qa-status.md) before treating an old
> "uncommitted" note as today's Git status or an OPEN bug as a release waiver.
> The additive [correction below](#f20f21-status-correction--2026-10-13)
> names the specific later source commits and residual BUG-022 work.
<!-- F20-F21 current-status notice end -->

Written as real defect reports, not as notes. Reproduction steps, expected vs
actual, root cause, fix, regression check — the same discipline as a tracker
ticket, because a defect described as "date thing was broken, fixed it" is
worth nothing to the person reading it in three months, and that person is the
author.

**A bug is not closed when the code works. It is closed when every field below
is filled**, including the last one.

Severity: **Critical** (data loss or wrong money) · **High** (a documented
requirement is not met) · **Medium** (wrong behaviour with a workaround) ·
**Low** (cosmetic).

State: `OPEN` · `IN PROGRESS` · `CLOSED` · `WONTFIX` (needs a reason).

## Register

| ID | Title | Severity | State | Found | Fix | Rule |
|---|---|---|---|---|---|---|
| BUG-001 | Save button invisible — white text on white background | High | CLOSED | S03 | fixed | R2 |
| BUG-002 | A fully paid loan still shows one instalment left | High | CLOSED | S03 | fixed | R3 |
| BUG-003 | Pay button stays on its busy label after a refused payment | Medium | CLOSED | S04 | fixed | R5 |
| BUG-004 | 20 wrong passwords a second make the app unusable for everyone | High | CLOSED | S07 | fixed | R6 |
| BUG-005 | One e2e test times out on runs that are ~3× slower than normal | Low | OPEN | S10 | — | — |
| BUG-006 | The load runner returned 127 after a run where every threshold passed | Low | CLOSED | S12 | fixed | R8 |
| BUG-007 | A test script never ran, and the suite reported it as green | Medium | CLOSED | S14 | fixed | R10 |
| BUG-008 | The API runner exits 127 on a green run, so the first CI build would be red | High | CLOSED | S14 | fixed | R8 |
| BUG-009 | The server segfaults on Node 20 in CI, so the first build was red | High | CLOSED | S15 | fixed | R11 |
| BUG-010 | The API runner exits 0 when the server never starts, so CI called it green | Critical | CLOSED | S15 | fixed | R8 |
| BUG-011 | Two servers started at once on one database, and one dies at boot | Medium | CLOSED | S16 | fixed | R12 |
| BUG-012 | Two processes writing one database answer 500 | High | CLOSED | S16 | fixed | R12 |
| BUG-013 | The edit panel opened underneath the bottom navigation | Medium | CLOSED | S16 | fixed | R13 |
| BUG-014 | Categories collapse to an 18 px strip on a short phone | High | CLOSED | S21 | S23 · uncommitted | R14 |
| BUG-015 | Editing an uncategorised expense sends category zero | Medium | CLOSED | S21 | a399e79 | R14 |
| BUG-016 | Concurrent registrations of the same email return 500 | High | CLOSED | S21 | e291ea9 | R14 |
| BUG-017 | Password suffixes after 72 bytes are silently ignored | High | CLOSED | S21 | 53b310b | R14 |
| BUG-018 | A large loan loses an integer cent in remaining money | Critical | CLOSED | S21 | bd516ac | R14 |
| BUG-019 | Oversized JSON is reported as an internal server failure | Medium | CLOSED | S21 | S23 · uncommitted | R14 |
| BUG-020 | Valid early-year dates produce malformed next dates | Medium | IN PROGRESS | S21 + 2026-10-10 controls | local, uncommitted | R14 |
| BUG-021 | Schedules cannot be edited through the interface | High | IN PROGRESS | S21 | local repair, uncommitted | R14 |
| BUG-022 | Expense overlay does not contain keyboard focus | Medium | IN PROGRESS | S21 | local repair, uncommitted | R14 |
| BUG-023 | Registration-race violation was ignored by final verdict | High | IN PROGRESS | 2026-10-09 control | local, uncommitted | — |
| BUG-024 | Required validator inputs could disappear with a green result | High | IN PROGRESS | 2026-10-09 control | local, uncommitted | — |
| BUG-025 | Race cleanup could remove another run's database | Medium | IN PROGRESS | 2026-10-09 control | local, uncommitted | — |
| BUG-026 | Unsafe pagination and IDs bypassed validation | High | IN PROGRESS | 2026-10-09 HTTP control | local, uncommitted | — |
| BUG-027 | Non-convertible note/icon JSON returned internal errors | High | IN PROGRESS | 2026-10-09 HTTP control | local, uncommitted | — |
| BUG-028 | Concurrent evaluator setup can abort before quota exercise | High | IN PROGRESS | 2026-10-10 controlled setup race | local, uncommitted | — |
| BUG-029 | Concurrent evaluator reports can overwrite each other | High | IN PROGRESS | 2026-10-10 fixed-clock control | local, uncommitted | — |
| BUG-033 | Main E2E reused one database between runs and ignored DB_PATH | Medium | IN PROGRESS | 2026-10-11 config/control audit | local, uncommitted | — |
| BUG-034 | Declared Node 22 floor could load a SQLite binding requiring Node-API 10 | High | IN PROGRESS | 2026-10-11 runtime controls | local, uncommitted | — |
| BUG-035 | Offset paging can duplicate or skip expenses after another client's write | Medium | IN PROGRESS | 2026-10-16 HTTP/browser controls | local, uncommitted | — |
| LIMIT-001 | Every request queues behind database work — 23× slower under write load | — | ACCEPTED | S07 | — | R6 |
| LIMIT-002 | The same POST twice creates two expenses (unkeyed requests; keyed saves replay — D-035) | — | ACCEPTED | S16 | — | — |

`LIMIT-###` is not a defect. It is a measured boundary of the design, recorded
here because everything the load smoke found is recorded — and because
a limit nobody wrote down gets rediscovered as a panic later.

The **Fix** column says whether a defect is fixed. The commits themselves belong
to the private development history and are not part of this public snapshot.

## Report template

```markdown
### BUG-### · <title> · <Severity> · <State>

| Found in | S##, how it surfaced |
| Component | path/to/file.js |

**Steps to reproduce:**
**Expected:**   (cite the spec section that says so)
**Actual:**
**Root cause:**  the mechanism, not the symptom
**Fix:**
**Regression:**  what was re-checked, and its output
**→ Rule R#**    or exactly: No rule — one-off.
```

Two fields do the real work:

- **Root cause** must name a *mechanism*. "Dates were wrong" is a symptom;
  "the `Date` constructor normalises day overflow instead of erroring" is a
  cause. Only the second one can produce a rule.
- **→ Rule** is the exit valve. Either this defect taught something reusable —
  and it becomes a project rule `R#` — or it explicitly did not. Without this
  field the register turns into an archive nobody reads.

---

### BUG-001 · Save button invisible — white text on white background · High · CLOSED

| | |
|---|---|
| Found in | S03, first look at the Add screen in a 375×812 viewport |
| Component | `public/style.css`, `public/index.html` |

**Steps to reproduce:**
1. Sign in and land on the Add screen.
2. Look at the bottom-right key of the keypad.

**Expected:** the primary action of the app's default screen is a blue button
reading `Uložiť`. Spec §6.1 requires a Save button, and it is one of the three
taps in the "two taps and a Save" definition of done (§8, session 4).

**Actual:** an empty white key. The text was in the DOM the whole time —
`textContent` was `"Uložiť"` — and it was rendered in white on white:

```
{ bg: "rgb(255, 255, 255)", color: "rgb(255, 255, 255)", text: "Uložiť" }
```

**Root cause:** CSS specificity resolved by source order. The element carried
both `.key` and `.btn--primary`. Both selectors have specificity (0,1,0), so
the later declaration wins — and `.key` is written further down the stylesheet
than `.btn--primary`. `.key` sets `background: var(--surface)` but no `color`,
so the background came from `.key` (white) and the colour from `.btn--primary`
(white). Neither rule was wrong on its own; the pair was split by declaration
order, and half of each won.

**Fix:** the save key stopped borrowing `.btn--primary`. It has its own
`.key--save.key` rule — specificity (0,2,0), above both — which sets background,
border and colour together, so they can no longer be separated by ordering.

**Regression:** reloaded and re-read the computed style; also confirmed the
other two users of `.btn--primary` (`.auth` submit, `.row__pay`) were never
affected, because `.btn` is declared *before* `.btn--primary` rather than after.

```
{ bg: "rgb(61, 90, 254)", color: "rgb(255, 255, 255)", text: "Uložiť" }
```

**→ Rule R2.**

---

### BUG-002 · A fully paid loan still shows one instalment left · High · CLOSED

| | |
|---|---|
| Found in | S03, paying a 3-instalment loan to the end on the Upcoming screen |
| Component | `public/app.js` — `paySchedule`, `markRowFinished` |

**Steps to reproduce:**
1. Create a loan with `total_count = 3`.
2. Open Upcoming and press `Zaplatiť` three times.
3. Read the countdown line on that row.

**Expected:** `zostáva 0 z 3 · 0,00 €` alongside the finished state. Spec §4.2:
on the last payment `remaining_count` is 0 and the response carries
`"finished": true` **"so the UI can celebrate"**.

**Actual:** the finished state appeared correctly — green row, `Splatené 🎉`,
pay button removed — but the countdown still read:

```
zostáva 1 z 3 · 100,00 €
```

A loan the user has just finished paying claimed one instalment was still owed.

**Root cause:** two code paths updated the row and only one of them wrote the
countdown. A payment that does not finish the loan calls `loadUpcoming()`, which
re-renders every row from the server and is therefore always current. The final
payment deliberately does *not* reload — the list is filtered to `active=1`, so
a refresh would delete the row and the user would never see it complete — and
instead patched the row in place via `markRowFinished`, which changed styling
and removed the button but never touched the text. The displayed count was left
holding the value from the previous render.

This is the same failure the spec designs against in §5 by refusing to store
`next_due` and `remaining_count`: a derived value kept somewhere other than
where it is computed goes stale. The server obeys that rule; the DOM had quietly
become a second place where the value was kept.

**Fix:** the countdown string is now produced by one function,
`remainingText(total_count, remaining_count, amount_cents)`, called both by the
initial render and by the final payment — which passes `remaining_count`
straight from the `PATCH /pay` response. Two writers remain, but they can no
longer disagree about the text.

**Regression:** a fresh 2-instalment loan paid to the end, reading the countdown
at each step:

```
start       zostáva 2 z 2 · 100,00 €
after 1st   zostáva 1 z 2 · 50,00 €
after 2nd   zostáva 0 z 2 · 0,00 €
finished    row--done: true, "Splatené 🎉", pay button removed
```

**→ Rule R3.**

---

### BUG-003 · Pay button stays on its busy label after a refused payment · Medium · CLOSED

| | |
|---|---|
| Found in | S04, by TC-E2E-030 (`qa/e2e/pay-conflict.spec.js`) — a case written on suspicion, not a failure that showed up on its own |
| Component | `public/app.js` — `paySchedule`, `withBusy` |

Full report: [`qa/docs/defects/BUG-003-pay-button-stuck.md`](../qa/docs/defects/BUG-003-pay-button-stuck.md).

**Steps to reproduce:**
1. Create a loan with `total_count = 1` and open Upcoming.
2. Close the loan from elsewhere — a second tab, another device, a direct
   `PATCH /api/schedules/:id/pay`. Do not reload the screen.
3. Press `Zaplatiť`.

**Expected:** the conflict is reported and the button returns to offering the
action — `Zaplatiť`, enabled, accessible name unchanged. Spec §4.2 makes the
409 a documented state transition, so the interface has to survive it.

**Actual:** the toast was right. The button was left reading `Platím…`
permanently, while its `aria-label` still said `Zaplatiť Posledná splátka` —
the visible text and the announced name describing different things:

```
Expected: "Zaplatiť"
Received: "Platím…"
    14 × <button data-testid="schedule-pay-60" aria-label="Zaplatiť Posledná splátka">Platím…</button>
```

**Root cause:** an ordering mistake between a caller and a helper. `withBusy`
snapshots the button's label and restores it in a `finally`. `paySchedule` set
the busy label **itself, one line before calling it**, so the snapshot captured
`Platím…` and the restore made the temporary label permanent. Every other
caller was correct because none of them changed the label.

It could not be seen on the successful path: a successful payment re-renders
the list and the rebuilt button carries the right label. Only the path with no
re-render leaves the damaged button on screen.

**Fix:** the busy label moved inside `withBusy` as a third argument, applied
*after* the snapshot. The helper now owns both halves of the change, so it
cannot restore a label it did not set.

**Regression:** TC-E2E-030 stays in the suite as the regression case. Full run
afterwards:

```
60 passed (11.6s)
```

**→ Rule R5.**

---

### BUG-004 · 20 wrong passwords a second make the app unusable for everyone · High · CLOSED

| | |
|---|---|
| Found in | S07, by the k6 load smoke `qa/load/auth-burst.js` |
| Component | `src/auth.js` — `login`, `bcrypt.compareSync` |
| Affects | Every endpoint, including `/api/health` |

Full report: [`qa/docs/defects/BUG-004-bcrypt-blocks-event-loop.md`](../qa/docs/defects/BUG-004-bcrypt-blocks-event-loop.md).

**Steps to reproduce:**
1. `npm run test:load` (starts its own server on port 3100 with a throwaway
   database, so nothing else is touched).
2. The second scenario registers one account, then sends wrong passwords for it
   from 20 connections at once for 15 seconds.
3. Throughout, `GET /api/health` is polled 10 times a second and timed. It is
   measured for 5 seconds beforehand as well, to have a baseline.

**Expected:** `/api/health` does one `SELECT 1`, touches no user data, and has
nothing to do with logging in. It should stay fast. The load smoke's threshold
is `p(95) < 250 ms`, which is already generous for such a request.

**Actual:** the whole server stops responding usefully.

```
login attempts    305 in 15s  (20/s)
refused 401       305
rate limited 429  0        <- nothing stops a guesser yet
login latency     avg 1017.8 ms   p95 1099.1 ms

GET /api/health — the same trivial request, measured twice:
  idle            avg 0.8 ms      p95 1.2 ms
  under load      avg 1134.9 ms   p95 1819.1 ms
  cost of load    1494.8× slower at p95

ERRO thresholds on metrics 'health_latency_under_load' have been crossed
```

**1.2 ms to 1819 ms.** Twenty wrong passwords a second — a rate a single phone
on a bad connection could produce by accident — and every other user waits
almost two seconds for a request that should take one.

**Root cause:** `src/auth.js` calls `bcrypt.compareSync`. bcrypt is *designed*
to be expensive — that is the entire point of it, and 10 rounds costing ~50 ms
is correct and should not be lowered. The defect is the **`Sync`**.

Node runs JavaScript on one thread. A synchronous call does not compute
*alongside* other requests, it computes *instead of* them: for those ~50 ms the
process cannot accept a connection, parse a request, or answer anything at all.
Twenty concurrent attempts do not share the cost, they queue behind each other,
and everybody else queues behind the lot. The asynchronous `bcrypt.compare`
hands the work to libuv's thread pool, where it occupies a worker instead of
the whole server.

Two things make it worse and are worth naming:

- **The endpoint is unauthenticated.** No account, no token, no prior
  relationship is needed to make the server spend 50 ms of CPU.
- **Nothing limits attempts.** 305 attempts were made and 305 were processed.

`register` has the same shape (`bcrypt.hashSync`), and the write smoke measured
it from the other side: setting up 50 accounts took 2800 ms, ~56 ms each,
strictly one after another.

**Not the same as LIMIT-001.** That one is queuing behind ~0.5 ms of database
work and costs 23×. This is queuing behind ~50 ms of deliberate CPU burn and
costs 1495×. Same mechanism, two orders of magnitude apart — which is why one
is an accepted limit and this is a defect.

**Fix (S08):** rate limiting, per **D-016** — 5 failures inside a 15-minute
window, then 429 with `Retry-After`, counted against the e-mail and the client
IP independently. `src/ratelimit.js`, called from the login route **before**
`login()` is invoked. That ordering is the fix: the whole cost of the defect was
bcrypt, so a limiter running after it would have protected nothing.

**Regression:** `qa/load/auth-burst.js` was already the regression check and was
already failing, so no new test was needed — it flipped colour. Same script,
same 20 connections, same 15 seconds:

```
                     before            after
login attempts       305               113 062
reached bcrypt       305               5          (the allowance)
rate limited 429     0                 113 057
login latency avg    1017.8 ms         2.6 ms
health p95 idle      1.2 ms            1.2 ms
health p95 loaded    1819.1 ms         5.3 ms
                     1495× slower      4.5× slower
threshold            CROSSED           passes
```

Throughput rising from 20/s to 7 537/s is itself evidence the limiter sits in
the right place: refusing became cheap because it now happens before the
expensive part.

Boundary behaviour is covered separately by the API collection, folder
**08 · Login rate limiting** — the last allowed attempt, the first refused one,
`Retry-After`, the correct password not bypassing the block, the window lifting
by itself, and a successful login clearing the counter.

**Residual, stated rather than glossed:** each of the 5 allowed attempts still
blocks the event loop for ~50 ms, because `bcrypt.compareSync` is still
synchronous. The reported defect — trivial traffic making the app unusable —
is gone and measured gone, so this is closed. The remaining cost is bounded by
the limiter and is recorded in D-016. Moving `auth.js` to `bcrypt.compare` is
the deeper fix and is a change of its own, not a footnote to this one.

---

### The residual, closed (S12)

The paragraph above stood for two sessions. It is now discharged.

**It had never been measured**, only reasoned about — the burst script cannot
see it, because after five attempts everything is a cheap 429 and the expensive
part hides behind the limiter that hides it. So a third script was written,
`qa/load/allowed-logins.js`, which runs against a server whose limiter is
switched off (`LOGIN_MAX_FAILURES` very high). That is not a realistic
deployment; it is the only way to ask what the *allowed* attempts cost.

The answer was worse than the prose suggested:

```
five concurrent logins, all reaching bcrypt        before          after
  attempts completed in 15s                        285             1103
  login latency, avg                               265.5 ms        67.9 ms
  GET /api/health  idle p95                        1.5 ms          1.5 ms
  GET /api/health  under load p95                  422.4 ms        1.0 ms
                                                   285.8× slower   0.7×
```

**Five wrong passwords — inside the allowance, from one person mistyping —
made every other request take four tenths of a second.**

**Fix:** `src/auth.js` moved to `bcrypt.hash` and `bcrypt.compare`.
`register()` and `login()` became `async`, and the two routes in `server.js`
with them. bcrypt is unchanged at 10 rounds — the cost is the security property
and must not be lowered. What changed is where it is paid: on a libuv thread
pool worker instead of the event loop, so one login occupies a worker rather
than the whole process. Express 5 forwards a rejected promise to the error
handler on its own, so the single error renderer in §5 still sees everything and
no route grew a try/catch.

**The ordering that had to survive, and did.** `rateLimit.check()` is still the
first thing the login route does, before `await login(...)`. Reversing them
would hand back the entire cost of BUG-004 — the limiter's whole value is that
it refuses *before* the expensive part. Asserted structurally rather than by
timing: TC-API-071 sends the **correct** password while blocked and still gets
429, which is only possible if the check runs before authentication.

**Regression:** `qa/load/allowed-logins.js` keeps a threshold of
`health_latency_under_load: p(95) < 100`. Synchronous bcrypt cannot hold it —
it measured 422 ms. It now passes at 1.0 ms.

Also worth recording: login latency **fell** from 265 ms to 68 ms. The attempts
now run in parallel on the pool instead of queueing behind each other, and
throughput went from 285 to 1103 in the same 15 seconds — about four times,
which is the default pool size.

**LIMIT-001 is unaffected.** It describes `better-sqlite3`, which is
synchronous by design and has no async form; the write path still queues, still
at about 20×, and is still accepted.

**→ Rule R6.**

---

### LIMIT-001 · Every request queues behind database work · ACCEPTED

| | |
|---|---|
| Found in | S07, by the k6 load smoke `qa/load/expense-write.js` |
| Component | `src/db.js` — `better-sqlite3`, synchronous by design |

Full report: [`qa/docs/defects/LIMIT-001-serialised-database-work.md`](../qa/docs/defects/LIMIT-001-serialised-database-work.md).

**Not a defect.** Recorded because everything the smoke found is recorded,
and because a limit that is measured and written down is a decision,
while the same limit discovered in production is an incident.

**What was measured:** 50 users writing expenses as fast as they can for 30
seconds, while `GET /api/health` is polled throughout and, for 5 seconds
beforehand, against an idle server.

```
writes            79322 requests, 2097/s
failed            0.000 %
server errors     0
write latency     avg 19.0 ms   p95 26.4 ms   max 55.7 ms

GET /api/health — the same trivial request, measured twice:
  idle            avg 1.0 ms    p95 1.4 ms
  under load      avg 19.5 ms   p95 32.4 ms
  cost of load    23.4× slower at p95
```

**What was expected and did not happen:** `SQLITE_BUSY`, a locked database, a
5xx, a corrupted row, a lost write. None appeared. 79 322 writes, zero errors.
That is worth stating as plainly as a failure would be — the thing the smoke
went looking for is not there.

**Why it is not there:** `better-sqlite3` is synchronous and Node is
single-threaded, so writes cannot actually overlap inside one process. They are
serialised by the event loop before SQLite ever sees contention, and WAL mode
handles the rest. The design that causes the slowdown is the same design that
prevents the corruption.

**The limit, stated:** throughput is about **2 100 writes/second**, and while
the database is busy every request — including ones that never touch it — is
roughly **20× slower**. For a personal application with one user this is not a
constraint anyone will meet; a household of four will never see it. It would
matter if this ever became multi-tenant, and at that point the answer is not a
faster query but moving the work off the request thread.

**Accepted** on that basis. If the app ever grows a second concurrent user in
earnest, this entry is the starting point rather than a surprise.

**→ Rule R6.**


---

### BUG-005 · One e2e test times out on runs that are ~3× slower than normal · Low · OPEN

| | |
|---|---|
| Found in | S08, and again in S10 |
| Component | unknown — that is the point of this entry |
| Affects | `qa/e2e/schedules.spec.js › the 31st is accepted and explains itself` |

Full report: [`qa/docs/defects/BUG-005-e2e-timeout-on-slow-runs.md`](../qa/docs/defects/BUG-005-e2e-timeout-on-slow-runs.md).

**Not characterised. Open deliberately rather than closed as "flaky".**

**What happens:** the suite normally finishes in about 11 seconds. Twice now it
has taken 36–39 seconds, and on both of those runs the same single test failed:

```
Error: locator.fill: Test timeout of 30000ms exceeded.
qa/e2e/schedules.spec.js › Schedules › the 31st is accepted and explains itself
```

The 30 000 ms is the **test** budget, not the action's own timeout — so the test
spent its entire allowance before a `fill` could act.

**Both occurrences share a signature:** same test, and a whole-suite runtime
roughly three times normal. That is no longer coincidence at two data points,
which is why it is written down rather than shrugged at.

**Why that test and not another:** it has the longest chain of sequential UI
actions in the suite — navigate, fill, assert, fill, assert, fill, fill, fill,
click, assert. If everything is slower, it is the first to exhaust a fixed
budget.

**What was tried, and did not reproduce it:**

| Attempt | Result |
|---|---|
| The test alone, repeatedly | passes, ~0.5 s |
| Full suite, four consecutive runs | 64/64, 10.6–11.4 s |
| Full suite twice from a cold database | 64/64, ~11 s |
| Full suite **while the k6 load smoke saturated a core** | 64/64, 11.4 s |

**Leading suspicion, unconfirmed:** every e2e test registers its own user, and
registration runs `bcrypt.hashSync` — about 55 ms of blocked event loop each,
measured in S07. Four parallel workers plus a loaded machine could queue the
server enough to stall a page mid-render. That is the residual of **BUG-004**,
still outstanding: the limiter capped how *often* bcrypt runs, not what it costs
when it does. Named as a suspicion, not a cause — the load experiment above
should have provoked it and did not.

**What was NOT done:** the `expect` and test timeouts were not raised. That
would make the symptom go away without anyone learning anything, and this
project's own exit criterion 6 (`qa/docs/test-plan.md`) forbids exactly that —
a test may start passing because the application changed, not because the
assertion was relaxed.

**Next step when it recurs:** the run that fails should be captured with
`--trace on` and `PWDEBUG` timing, and the server's own request timings logged
alongside, so the queue can be seen rather than guessed at. A third occurrence
turns the suspicion above into something testable.

**→ No rule yet.** A rule drawn from an uncharacterised failure would be a
guess with a number on it.


---

### BUG-006 · The load runner returned 127 after a run where every threshold passed · Low · CLOSED

| | |
|---|---|
| Found in | S12, while adding the third load script |
| Component | `qa/load/run.js` |

Full report: [`qa/docs/defects/BUG-006-load-runner-exit-127.md`](../qa/docs/defects/BUG-006-load-runner-exit-127.md).

**Steps to reproduce:** run `npm run test:load`. Every k6 process exits 0, every
threshold passes, the summary prints — and the runner exits **127**.

**Expected:** the exit code is the result. A green run must report success, or
the command cannot be used as a gate.

**Actual:** 127, consistently. Earlier in the same investigation the runner also
died *silently* between scripts, so the second and third measurements never ran
at all and nothing was printed about why.

**Root cause: two, in the same few lines.**

1. `startServer` attached `server.on('error', …)` that called `process.exit(1)`.
   That handler was written for "the server would not start", but it also fires
   when the child is killed on purpose. Cleaning up after the first script
   therefore ended the whole run — with the message buried in k6's output, so it
   read as "it just stopped".
2. With that fixed, the exit code stayed wrong. Bisected by removing one thing
   at a time: **calling `child.kill()` at all** was enough to corrupt the
   runner's own exit status on this machine. Guarding it with a benign `error`
   listener did not help; try/catch around it did not help; moving it into a
   `process.on('exit')` handler did not help. Removing the kill did, instantly
   and repeatably.

The mechanism behind the second one is not identified, and saying so is more
useful than a guess with a number on it.

> ### ⚠ Correction, S14 — cause 2 above is wrong
>
> The same 127 turned up in `qa/api/run.js` (BUG-008) and was isolated properly
> there. **`child.kill()` is not the trigger.** Killing a spawned server and
> returning normally exits 0, every time.
>
> The trigger is **`fs.rmSync` on a `better-sqlite3` database another process
> still has open**, which terminates the calling process inside the call — no
> exception, no return value. The bisection above removed the kill *and* the
> delete together, because `cleanUp` did both, and the wrong half got the credit.
>
> The fix was right for the wrong reason, which is worse than it sounds: it left
> "do not kill children" behind as a rule, when the real rule is "do not delete a
> database somebody still has open". The first is superstition and would
> eventually be dropped as such; the second is a mechanism.
>
> Measured in BUG-008. R8 rewritten accordingly. The load runner's code needs no
> change — removing the delete was the half that mattered — and ports 3100–3102
> were re-confirmed free after a full run in S14.

**Fix:** the runner no longer kills anything. The servers are its children and
die with it — confirmed by checking ports 3100–3102 afterwards, all free. The
only remaining housekeeping is deleting old `data/load-*.db` files, and that
moved to the **start** of a run, where it cannot affect a result that has not
happened yet. k6 is also spawned directly rather than through `shell: true`,
which removes Node's own deprecation warning about unescaped arguments.

**Regression:**

```
runner -> 0
scripts run: 3
summaries: qa/reports/load-*.json
ports 3100, 3101, 3102 free afterwards
```

**→ Rule R8.**

---

### BUG-007 · A test script never ran, and the suite reported it as green · Medium · CLOSED

| | |
|---|---|
| Found in | S14, running the suite as a routine check after an unrelated change |
| Component | `qa/api/wallet.postman_collection.json` — `08 · Settings and the month balance / Another user's income does not leak` |

Full report: [`qa/docs/defects/BUG-007-test-script-never-ran.md`](../qa/docs/defects/BUG-007-test-script-never-ran.md).

**Steps to reproduce:** `npm run test:api` and read the summary line.

**Expected:** 93 requests, and every one of them running its assertions.

**Actual:**

```
requests   93  (0 failed)
assertions 337  (0 failed)
```

Green. Underneath, newman's own table said `test-scripts  93  1` — one script
had failed to execute:

```
1.  SyntaxError
      missing ) after argument list
      at test-script
      inside "08 · Settings and the month balance / Another user's income does not leak"
```

That request asserted **nothing**. Its three checks — the 200, the schema, and
the property that user B's income is not user A's — never ran, and the number
`337` was three short with no indication that anything was missing.

The request is a cross-user isolation check. Spec §4.3 is the reason it exists.

**Root cause:** an apostrophe.

```js
pm.test('user B has their own income, not user A's', function () {
```

The string is single-quoted and the name contains `user A's`, which closes it
early. The rest of the line is then a syntax error, so the script never parses
and never runs. The neighbouring test at line 875 got this right —
`pm.test("user B's categories are not user A's rows", …)` — so the collection
contains both the mistake and its own counter-example.

**Why nothing caught it.** Three separate mechanisms each nearly did:

1. **The summary line** printed `assertions 337 (0 failed)`. A script that
   throws before its first `pm.test` contributes zero assertions, and zero
   failures. Absence looks identical to success.
2. **The exit code** was 127 — but that is BUG-008, which was happening on green
   runs too, so it carried no signal.
3. **Gate C8** counts statuses asserted in the collection by matching
   `expectStatus(…)` in the script text. A script that never executes still
   matches the regex. C8 reads the source, not the run.

Every one of those is a report about the run that cannot distinguish "checked
and passed" from "did not check".

**Fix:** two parts, and the second is the one that matters.

- The test name moved to double quotes, matching the sibling test.
- `qa/api/run.js` now prints a `scripts` line **always**, and an explicit
  warning when it is non-zero:

  ```
  requests   93  (0 failed)
  assertions 340  (0 failed)
  scripts    93  (0 failed to run)
  ```

  A count that only appears when something is wrong is a count nobody learns to
  read. Printing it on every run makes `340` and `93/93` mean something
  together.

**Regression:** the three missing assertions came back — 337 → **340** — and the
cross-user income check now actually runs.

**→ Rule R10.**

---

### BUG-008 · The API runner exits 127 on a green run, so the first CI build would be red · High · CLOSED

| | |
|---|---|
| Found in | S14, checking the exit code of `npm run test:api` by hand |
| Component | `qa/api/run.js` — `cleanUp` |
| Affects | `.github/workflows/ci.yml`, job **api** — the step that gates the whole pipeline |

Full report: [`qa/docs/defects/BUG-008-api-runner-exit-127.md`](../qa/docs/defects/BUG-008-api-runner-exit-127.md).

**Steps to reproduce:**

```
npm run test:api ; echo $?
```

**Expected:** 0. Every assertion passed.

**Actual:** 127, on a run of 93 requests and 340 assertions with nothing failed.
Reproduced directly under `node qa/api/run.js` as well, so it is not npm
mangling anything.

**Why this is High and BUG-006 is Low.** Same symptom, different blast radius.
BUG-006 was in the load runner, which nothing depends on. This one is the CI
step `- run: npm run test:api`, which gates the e2e job and therefore the whole
pipeline. **The first build after the first push would have been red**, on a
step that had in fact passed — and a red first build on a repository being read
as a work sample is expensive in a way a wrong exit code normally is not.

**Root cause — isolated, not inferred.** BUG-006 blamed `child.kill()`. That is
wrong, and this is where it was shown to be wrong. Five reductions, each a
standalone script:

| # | What it did | Exit |
|---|---|---|
| 1 | spawn a server, kill it, return normally | **0** |
| 2 | spawn, kill, then `rmSync` the database | **127** |
| 3 | same as 2, with synchronous logging | **127** — dies *inside* `rmSync`, no throw, no return |
| 4 | spawn, **no kill**, `rmSync` the live server's database | **127** |
| 5 | spawn, kill, **wait for the `exit` event**, then `rmSync` | **0** |

Test 1 clears the kill. Test 4 convicts the delete on its own. Test 3 shows the
process is *terminated inside the call* — `fs.rmSync` neither returns nor
throws, and the line after it never prints even with synchronous writes.

Test 6 narrowed it further: a plain file held open by another process deletes
cleanly and the caller survives. So it is specific to a database
`better-sqlite3` still has open, not to open files in general.

**What is still not identified:** *why* the process is terminated rather than
receiving `EBUSY`. Windows 11, Node v24.13.1. Stated rather than guessed — the
trigger is pinned to one line, which is what a fix needs, and the rest would be
a story.

**Fix:**

- The run's own database is never deleted. Old `data/api-*.db` files are swept
  at the **start** of a run, where they cannot affect a result that has not
  happened yet (R8).
- The server is killed and **awaited** — `server.once('exit', …)` before
  returning. Three things have to hold at once: the child must die (or it
  outlives the run holding port 3001), the process must end by itself (a live
  child keeps the event loop referenced — a version without the kill hung for
  five minutes), and the code must survive (`process.exit()` truncates buffered
  stdout, which swallowed the entire summary and the HTML report when it was
  tried).

**Regression:**

```
npm run test:api           requests 93 (0 failed), assertions 340 (0 failed)
exit code                  0
qa/reports/api-report.html 963 KB, written
port 3001 afterwards       no LISTENING socket
data/api-*.db              swept at the start of the next run
```

And, for the correction it forced on BUG-006, a full load run afterwards:
ports 3100–3102 free, runner exits 0.

**→ Rule R8** (rewritten).

---

### BUG-009 · The server segfaults on Node 20 in CI, so the first build was red · High · CLOSED

| | |
|---|---|
| Found in | S15, the first CI run after the first push |
| Component | `.github/workflows/ci.yml` — `NODE_VERSION`, and `package.json` `engines` |
| Affects | both jobs that start the server: **api** and **e2e** |

Full report: [`qa/docs/defects/BUG-009-segfault-on-node-20.md`](../qa/docs/defects/BUG-009-segfault-on-node-20.md).

**Steps to reproduce:** run the workflow on `ubuntu-latest` with
`node-version: 20`.

**Expected:** the same green suite as locally — 340 assertions, 92 e2e tests.
Spec §2 says Node 20+, and `package.json` said `engines: >=20`.

**Actual:** the server dies the moment it is started.

```
[WebServer] Segmentation fault (core dumped)
Error: Process from config.webServer was not able to start. Exit code: 139
```

139 is 128 + 11 — SIGSEGV. The api job hit the same thing one job earlier,
invisibly, because its server is started in the background:

```
the server at http://localhost:3001 never became healthy (fetch failed)
```

**Root cause:** `better-sqlite3@13.0.3` declares `engines: { "node": ">=22" }`.
CI pinned Node **20**. npm treats `engines` as advice unless `engine-strict` is
set, so the install succeeded, and the native binary loaded into a runtime it
was not built for and died with SIGSEGV rather than an error anybody could read.

Two of our own files carried the same wrong claim:

| | Said | True |
|---|---|---|
| `package.json` `engines` | `>=20` | `>=22`, forced by better-sqlite3 |
| `.github/workflows/ci.yml` | `NODE_VERSION: '20'` | a runtime the dependency does not support |

Nothing lied deliberately. The floor was written when the dependency list was
short, and the dependency raised its own floor later, quietly, in a minor
version bump nobody re-read.

**Also worth stating:** Node 20 reached end of life in April 2026. CI was
pinned to an unsupported runtime, which is a problem the segfault merely made
visible.

**Fix:** `NODE_VERSION: '22'` and `engines: ">=22"`. Recorded as **D-028**,
including the conflict with spec §2's "Node.js 20+" — the spec is not edited,
the departure is a dated decision.

**Why 22 and not the 24 this is written on:** 22 is the floor the project now
claims, and the floor is the version most likely to break. The top of the range
is covered by the machine it is developed on. A CI that only tests the newest
runtime cannot tell you whether your stated minimum is a real number.

**Regression:** the workflow itself. Its previous run is the failing case, kept
in the run history rather than described.

**→ Rule R11.**

---

### BUG-010 · The API runner exits 0 when the server never starts, so CI called it green · Critical · CLOSED

| | |
|---|---|
| Found in | S15, reading the CI logs of the run that BUG-009 made red |
| Component | `qa/api/run.js` — `main` |
| Affects | the CI gate on the whole API layer |

Full report: [`qa/docs/defects/BUG-010-runner-green-on-no-server.md`](../qa/docs/defects/BUG-010-runner-green-on-no-server.md).

**This is the worst defect in the register**, and it is worth saying why in one
line: every other entry is something that broke. This one is something that
**passed when it should have broken**.

**Steps to reproduce:** make the server fail to start, then run
`npm run test:api` and read the exit code.

```
node -e "require('http').createServer((q,s)=>{s.writeHead(500);s.end()}).listen(3060)" &
QA_PORT=3060 node qa/api/run.js ; echo $?
```

**Expected:** non-zero. Zero requests were sent and nothing was verified.

**Actual (before the fix):** the CI job printed the failure and passed:

```
the server at http://localhost:3001 never became healthy (fetch failed)
✓ API checks (newman) in 55s
```

Followed, one step later, by the only other trace of it:

```
##[warning]No files were found with the provided path: qa/reports/.
```

**Root cause:** the exit code was assigned *after* an `await` that could never
resolve.

```js
if (server && !server.killed) {          // the child is dead; killed is false
  await new Promise((resolve) => {
    server.once('exit', resolve);        // 'exit' already fired — never again
    server.kill();                       // returns false, emits nothing
  });
}
process.exitCode = code;                 // never reached
```

`server.killed` answers "was a signal sent", not "is the child gone". For a
child that died on its own it is `false`, so the branch was taken; the `exit`
event had already fired, so the promise never settled; `main()` never returned;
and with no handles left, Node exited **0**.

Three separate things had to line up, which is exactly why it survived: the
server had to die *by itself* (a kill would have worked), the failure had to be
in the try block (so `code` was already 1 and looked handled), and the process
had to have nothing else keeping it alive (so it exited quietly instead of
hanging, which would have been noticed).

**This is BUG-008 again, inverted.** That one let cleanup turn a pass into 127;
this one let cleanup turn a failure into 0. Same rule broken from both sides:
**the result must be recorded before cleanup, and nothing after may change it.**
R8 said so already, and the previous fix still put the assignment last.

**Fix:**

- `process.exitCode = code` moved **above** all cleanup.
- The child's death is tracked from spawn with `server.once('exit', …)` setting
  a flag, instead of asking `server.killed`.
- A 5-second `unref`'d timeout on the wait, so a child that ignores SIGTERM
  costs a stray process rather than the run.

**Regression:** reproduced with a port blocker so the server dies of
`EADDRINUSE` and the health check never passes — the exact CI shape:

```
the server at http://localhost:3060 never became healthy (HTTP 500)
EXIT: 1
```

And the ordinary green path still reports itself correctly: 93 requests, 340
assertions, exit 0.

**→ Rule R8** — unchanged in wording, broken twice in implementation, which is
the more useful fact about it.

---

### BUG-011 · Two servers started at once on one database, and one dies at boot · Medium · CLOSED

| | |
|---|---|
| Found in | S16, the first time `qa/race/` tried to start two servers against one file |
| Component | `src/db.js` — the boot pragmas |

**Steps to reproduce:** delete the database file, then start two servers with
the same `DB_PATH` at the same moment. Under CPU load, one of them dies before
it listens.

**Expected:** both start. Nothing in the app claims a database may have only one
process on it, and SQLite is built for exactly this.

**Actual:**

```
SqliteError: database is locked
    at Database.pragma (better-sqlite3/lib/methods/pragma.js:11:44)
    at Object.<anonymous> (src/db.js:16:4)
  code: 'SQLITE_BUSY'
```

**Root cause:** `db.pragma('journal_mode = WAL')` needs a lock no other
connection is holding. On a **fresh** file both processes attempt the switch,
and the loser gets SQLITE_BUSY. Later boots are unaffected — the file is already
in WAL and the statement is a no-op — which is why it is a first-boot defect and
why it hid for so long.

`busy_timeout` alone does not fix it, and finding that out is the useful part:
after adding it, a run still died — this time inside the **read** of
`journal_mode`. Some pragma paths refuse rather than queue, and a pragma that
cannot be read is not one that can be waited for.

**Measured, because the first attempt to reproduce it failed and a defect
nobody can provoke on demand is a story:**

| | deaths |
|---|---|
| original code, idle machine, 42 trials | 0 |
| original code, **6 CPU hogs running**, 20 trials | **2** (SQLITE_BUSY) |
| fixed code, same load, 20 trials | 0 |

Load is the trigger: it widens the window between the first process's schema
write and the second process's pragma. Two earlier sightings had both happened
while the machine was busy, which at the time looked like coincidence.

**Fix:** `busy_timeout` first, then a `whileLocked(label, step)` helper that
retries a boot step for up to five seconds while SQLite reports a lock — applied
to the pragmas and to the schema replay. The journal mode is now **read before
it is set**, so the contended write happens only on the one boot that has to
perform it.

**Regression:** the 20-trial harness under load, and `qa/race/` itself, which
starts two servers on one file every time it runs.

**→ Rule R12.**

---

### BUG-012 · Two processes writing one database answer 500 · High · CLOSED

| | |
|---|---|
| Found in | S16, `qa/race/` scenario C |
| Component | `src/routes/schedules.js` — both transactions |
| Affects | any deployment with more than one server process on one database file |

Full report: [`qa/docs/defects/BUG-012-deferred-transaction-500.md`](../qa/docs/defects/BUG-012-deferred-transaction-500.md).

**Steps to reproduce:** `npm run test:race`. Scenario C pays a loan on one
server while editing it on another, both sharing one database file.

**Expected:** both requests succeed, or one loses a coherent race. Spec §5:
**500 must never be reachable.**

**Actual:** 4 of 40 pairs answered 500.

```
C · pay vs edit — TWO processes, one database file
      36 × pay 200 · edit 200
       4 × pay 200 · edit 500
    violations: 4

SqliteError: database is locked   ... at src/routes/schedules.js:199
  code: 'SQLITE_BUSY'
```

**Root cause:** the transaction type. `db.transaction()` issues a plain `BEGIN`,
which is **deferred** — it takes a read lock and upgrades to a write lock at the
first write. If another connection has written in the meantime, SQLite refuses
**immediately** with SQLITE_BUSY, and `busy_timeout` does not apply: the
snapshot the transaction started from is stale, and waiting cannot un-stale it.

The global `busy_timeout = 5000` added for BUG-011 is therefore no help at all
here, which is worth stating plainly — two defects, both reported as "database
is locked", with different mechanisms and different fixes.

**Fix:** `pay.immediate()` and `edit.immediate()`. `BEGIN IMMEDIATE` takes the
write lock up front, where `busy_timeout` **does** apply, so the second writer
queues instead of being refused.

**Regression:**

```
before   4 of 40 cross-process pairs answered 500
after    40 of 40 answered 200, zero invariant violations
```

**→ Rule R12.**

---

### BUG-013 · The edit panel opened underneath the bottom navigation · Medium · CLOSED

| | |
|---|---|
| Found in | S16, by the end-to-end suite on the phone viewport |
| Component | `public/index.html`, `public/style.css` — the edit sheet |
| Affects | editing an expense on a phone, which is every user of a phone-first app |

**Steps to reproduce:** at 375×812, open an expense for editing and press Save.

**Expected:** the panel is above everything, and its buttons can be pressed.

**Actual:** the Save button could not be clicked. Playwright resolved the
element, scrolled to it, found it "visible, enabled and stable" — and the click
never landed, because the fixed bottom navigation was on top of it.

**Five of six tests failed on `mobile-chromium` and all six passed on
`desktop-chromium`.** That split is the signature: a stacking problem shows up
where the viewport is short enough for the two elements to overlap.

**Root cause:** the panel was written inside `#screen-month`, and `.screen` is a
flex child in its own place in the stacking order. A `z-index` set on a
descendant is confined to its ancestor's stacking context, so `z-index: 40`
competed with the other children of that section — not with the navigation bar,
which is a sibling of the section, painted later, and therefore on top.

The element was genuinely visible. Nothing about it was hidden, disabled or
mispositioned. It was underneath something, which is a different failure and one
that `toBeVisible()` cannot detect — the assertion that would have "passed" here
is exactly the one a person writes by intuition.

**Fix:** the panel moved out of the section to become a sibling of the
navigation, where its `z-index` competes with it directly, and raised to 50.
Closing it on a screen change moved into `showScreen`, because hiding the
section no longer hides the panel.

**Regression:** the six editing tests, on both viewports. They were written
before the fix and failed for the right reason, which is the only way to know a
regression test would have caught the defect it is named after.

**→ Rule R13.**

---

### LIMIT-002 · The same POST twice creates two expenses · ACCEPTED

> **S23 update (D-035).** Narrowed, not closed. A POST that carries an
> `Idempotency-Key` is now retry-safe: same key and payload replays the first
> 201 (`Idempotency-Replayed: true`), a different payload is 409, a deleted
> expense is not resurrected. The AI review screen always sends a key. Unkeyed
> POSTs — the keypad path, Newman, pytest — behave exactly as measured below,
> and that remains correct HTTP. Evidence: `qa/ai/tests/idempotency.test.js`
> (20 concurrent same-key saves → 1 row), Newman folder 11, pytest
> `test_parallel_retries_with_one_key_create_one_expense`.

| | |
|---|---|
| Found in | S16, `qa/race/` scenario D — a check requested explicitly |
| Component | `src/routes/transactions.js` — `POST /`, and the absence of an idempotency key |

**What was measured:** two byte-identical `POST /api/transactions` requests sent
with `Promise.all`, forty times.

```
D · the same POST twice, as a network retry would send it
      40 × 201 · 201
      40 × 2 row(s) stored
    pairs that produced a duplicate row: 40 of 40
```

**Every pair duplicated. There is no deduplication of any kind.**

**This was classified in advance — "if it duplicates, it is a real defect,
full report." The measurement disagrees, and the disagreement is the report.**

Two POSTs producing two rows is HTTP working as specified: POST is not
idempotent, and a server that quietly collapsed two of them would be wrong in a
way much harder to see than a duplicate. Two €2.00 coffees on one day is an
ordinary thing to buy. A screen that deduplicated them would hide an expense
that really happened, and the missing row is far harder to notice than the extra
one.

So the question is not "does the API duplicate" — it does, correctly — but
**can a person using this application produce a duplicate?** That was tested
from the only side a person can reach (`qa/e2e/double-submit.spec.js`):

| Attempt | Result |
|---|---|
| Two fast taps on Save | one expense |
| Enter pressed twice on the schedule form | one schedule |
| A second Save after the first finished | two expenses — correctly |

`withBusy` disables the control synchronously, before the first request is
awaited, so the second event lands on a disabled button. **No reachable path in
this application produces a duplicate.**

**What remains, stated rather than dismissed:** a transport-level retry would
duplicate, and nothing here would stop it. Browsers do not retry POSTs on their
own and this app has no service worker, so there is no such path today. If one
ever appears — an offline queue, a retrying proxy — the fix is an
`Idempotency-Key` header, which is a change to the API contract in spec §5 and
therefore a `D-###`, not a patch.

**Accepted** on that basis: correct protocol behaviour, no reachable defect, and
the mechanism that protects it named — because a protection nobody can point at
is a coincidence waiting to be refactored away.

**→ No rule.** The guard already exists (`withBusy`) and predates this check.

---

## S21 audit findings — no fixes applied

These observations come from a full audit of an earlier version. All active
reproductions used a temporary copy, synthetic accounts and separate SQLite
files. The green existing suite did not exercise these boundaries.

### BUG-014 · Categories collapse to an 18 px strip on a short phone · High · CLOSED

| | |
|---|---|
| Found in | S21, real Chromium at 320×568 |
| Component | `public/style.css` — Add flex layout and fixed-height controls |

**Steps to reproduce:** sign in with seeded default categories; resize to
320×568; open Add. Inspect the Categories group's visible height and screenshot.
**Expected:** readable/selectable categories alongside the keypad (spec §6.1).
**Actual:** clientHeight 18, scrollHeight 670. Labels are clipped to a narrow
strip. Save remains visible; horizontal document width is correctly 320.
**Root cause:** amount, note, keypad and navigation consume the available
height; the flexible scrolling category list absorbs the shortage.
**Fix:** S23, uncommitted. `public/style.css`, a `(max-width: 699px) and
(max-height: 760px)` block: the category list keeps a 150 px floor and still
scrolls inside, header and keypad are tighter, and the Add screen scrolls as a
whole when even that does not fit. Save stays one swipe away; nothing is hidden.
**Regression:** `qa/e2e/ai/add-layout.spec.js`, written and run red first:
clientHeight 18 at 320×568 and 108 at 375×667 against the old CSS (threshold
120). After the fix: 4/4 on mobile and desktop projects — list ≥ 120 px, two
rows fully visible, no horizontal overflow, amount → category → Save completes.
It lives in the AI suite because the defect guards the Add screen the AI entry
point sits on.
**→ Rule R14.**

### BUG-015 · Editing an uncategorised expense sends category zero · Medium · CLOSED

| | |
|---|---|
| Found in | S21, browser edit plus captured PATCH status |
| Component | `public/app.js` — openTransactionEditor / submitTransactionEdit |

**Steps to reproduce:** create a valid expense with category_id omitted/null;
open its Month row; change only Note; save.
**Expected:** only the changed note is patched, keeping category null (D-029).
**Actual:** PATCH includes category_id 0 and returns 400. Selecting a named
category is a workaround, but incorrectly forces a classification change.
**Root cause:** the select contains no empty option; null is rendered as an
empty value and then Number('') becomes 0, differing from original null.
**Fix:** applied in commit `a399e79`. The editor's category list now opens with an
explicit *Uncategorised* option (value `""`), the same one the AI review form
already had, so "no category" is something the list can show and a person can
choose. On save the value is read as `rawCategory === '' ? null : Number(...)`,
so null stays null; the existing "send only what changed" comparison then sees
no change and leaves `category_id` out of the patch entirely. The server needed
nothing: `ownedCategoryId` already accepted null.
**Regression:** TC-E2E-070 (note-only edit), TC-E2E-071 (unchanged save sends
no request at all) and TC-E2E-072 (an expense created by paying a schedule that
has no category) in `qa/e2e/editing.spec.js`. They read the PATCH off the wire
rather than the screen, because the defect was in what the request carried: a
screen assertion would have passed the moment the toast said "saved". Control:
with the two lines of the fix reverted, all three fail on both viewports (6 of
6); with the fix, 18 of 18 in that file pass.
**→ Rule R14.**

### BUG-016 · Concurrent registrations of the same email return 500 · High · CLOSED

| | |
|---|---|
| Found in | S21, five pairs of concurrent registration requests |
| Component | `src/auth.js` register, `src/schema.sql` users.email UNIQUE |

**Steps to reproduce:** send two simultaneous POST /api/auth/register requests
with the same new synthetic email and valid password; repeat with fresh emails.
**Expected:** one 201, one controlled duplicate-email conflict, not INTERNAL.
**Actual:** all 5 pairs return 201 + 500; server sees SQLITE_CONSTRAINT_UNIQUE.
**Root cause:** both SELECT checks finish before async bcrypt.hash; the losing
INSERT violates UNIQUE, which is not mapped to the application's conflict error.
**Fix:** applied in commit `e291ea9`. The insert and the starter categories are now one
`db.transaction`, so an account can no longer exist without the rows it needs,
and `SQLITE_CONSTRAINT_UNIQUE` from that write is translated into the same
`conflict` the pre-read raises — a 409, not a 500. The pre-read stays as a fast
path that avoids hashing an obvious duplicate; it is no longer mistaken for a
guard, because it cannot be one: `bcrypt.hash` yields, and both requests pass it
before either writes.
**Regression:** scenario E in `qa/race/run.js` — two registrations of one fresh
address, sent together to two server processes sharing one database, 120 pairs
per run. Invariant: one 201 and one 409, in either order; any 5xx or a second
201 is a violation. Control: with the mapping removed the scenario reports
`201 · 500` and a violation on every pair (3 of 3 in the control run), with
`SQLITE_CONSTRAINT_UNIQUE` in the server log; with the fix, 0 violations.
**→ Rule R14.**

### BUG-017 · Password suffixes after 72 bytes are silently ignored · High · CLOSED

| | |
|---|---|
| Found in | S21, isolated register/login boundary probe |
| Component | `src/auth.js` — password validation and bcrypt |

**Steps to reproduce:** use a synthetic password of 72 ASCII `a` bytes followed
by `A`; register, then login with the same 72 bytes followed by `B`.
**Expected:** reject an unsupported length or distinguish accepted passwords.
**Actual:** register 201, changed-suffix login 200. This is not arbitrary
password bypass: the first 72 bytes must be identical.
**Root cause:** only a minimum character length is checked; bcrypt consumes
at most 72 bytes, which differs from JavaScript character length for Unicode.
**Decision D-045:** registration refuses a password over 72 UTF-8
bytes with a 400 and a message that says so. Login and stored hashes are left
exactly as they are. The alternative — re-hashing with a scheme that reads the
whole password — would have to run on accounts whose plaintext nobody has, so
it can only happen at the next sign-in, and until then the collision stays.
Refusing at the door removes it for every account that can still be created,
and no existing account can hold a longer password than the check now allows.
Bytes, not characters: bcrypt counts bytes, so "é" costs two and an emoji four.
**Fix:** applied in commit `53b310b`. `src/auth.js` rejects `Buffer.byteLength(password,
'utf8') > 72` in `register` with the ordinary `badRequest`, next to the existing
minimum-length check; `login` and `bcrypt.compare` are untouched. `public/app.js`
refuses the same thing before the request, counting with `TextEncoder` because
`password.length` counts characters, and names the limit in the toast.
**Regression:** TC-API-106 (72 ASCII bytes still accepted, 201), TC-API-107
(73 bytes → 400 `VALIDATION_FAILED`) and TC-API-108 (37 × `é` — 37 characters,
74 bytes → 400) in `qa/api/wallet.postman_collection.json`; TC-E2E-073 and
TC-E2E-074 in `qa/e2e/auth.spec.js` for the browser side. Both browser cases
also assert that **no** request is sent: the server's refusal contains the same
words as the client's, so a text-only assertion would pass with no rule in the
browser at all. Controls: with the server check disabled, 6 of 631 Newman
assertions fail and the 72-byte case still passes; with the client check
disabled, both browser cases fail. With both in place, Newman is 631 of 631 and
the auth file is 14 of 14 across the two viewports.
**→ Rule R14.**

### BUG-018 · A large loan loses an integer cent in remaining money · Critical · CLOSED

| | |
|---|---|
| Found in | S21, large-count schedule probe and exact BigInt comparison |
| Component | `src/validate.js` totalCount; `src/routes/schedules.js` shape |

**Steps to reproduce:** create a valid loan with amount_cents=99999999 and
total_count=99999999; compare remaining_cents with exact integer multiplication.
**Expected:** 9999999800000001 cents, or a controlled rejection of unsupported
totals; spec money invariant forbids silently wrong cents.
**Actual:** 201 with 9999999800000000 cents, an unsafe JavaScript integer.
total_count=1e30 is also accepted. These are extreme synthetic inputs.
**Root cause:** Number.isInteger does not imply safe precision; count and the
derived multiplication have no safe-integer/product bound.
**Decision D-046:** `total_count` is capped at 1200 — a hundred years
of monthly instalments — and `amount_cents × total_count` must be a safe
integer; anything else is a 400. Exact arithmetic (BigInt, or cents as strings)
would change the JSON money contract every client and test depends on, for
loans nobody takes; a bound keeps the contract and removes the wrong number.
**Fix:** applied in commit `bd516ac`. `src/validate.js` gained `MAX_TOTAL_COUNT = 1200`
in `totalCount`, and `loanTotalCents(amount, count)`, which refuses a pair whose
product is not a safe integer. `src/routes/schedules.js` calls it on create and,
inside the edit transaction, on the pair the edit would leave behind — raising
the amount of a long loan moves the product as surely as raising the count.
`public/app.js` refuses more than 1200 instalments in the form and says so.
With the two ceilings in place the largest possible product is 1.2e11, so the
product check cannot fire today: it is the invariant the money contract rests
on, kept true if either ceiling is ever raised, and no test can reach it while
both stand.
**Summary aggregates:** measured, not assumed. SQLite sums in 64-bit integers,
but `better-sqlite3` returns a JavaScript number by default: asked for a sum of
2^53 + 1 it answers 9007199254740992 — rounded, with no error (the same query
with `safeIntegers` returns the exact BigInt). `GET /summary` sums one account's
expenses for one month, each at most 100 000 000 cents, so the total leaves the
exact range only past 90 071 993 maximum-value expenses in a single month for a
single account. Nothing in the schema or the API caps how many rows a month may
hold, so that is unreachable in practice rather than impossible by construction.
The month balance and the limit arithmetic add numbers of the same size, so they
are exact whenever the total is. Left as it stands — it needs the same decision
about representation that this bug's fix deliberately avoided.
**Regression:** TC-API-109 (1200 instalments at the amount ceiling: 201 and
`remaining_cents` exactly 99999999 × 1200, asserted to be a safe integer),
TC-API-110 (1201 → 400), TC-API-111 (the reported loan, 99999999 × 99999999 →
400), TC-API-112 (1e30 → 400) and TC-API-113 (the same ceiling on `PATCH`) in
`qa/api/wallet.postman_collection.json`; TC-E2E-075 in `qa/e2e/schedules.spec.js`
for the form, which also asserts that nothing is sent. Controls: with the count
ceiling removed, 6 of 650 Newman assertions fail — and the two extreme loans are
still refused, by the product check; with both checks removed, 12 fail and the
reported loan is accepted again. With the client ceiling removed, TC-E2E-075
fails on both viewports. With everything in place: 650 of 650 and 16 of 16.
**→ Rule R14.**

### BUG-019 · Oversized JSON is reported as an internal server failure · Medium · CLOSED

| | |
|---|---|
| Found in | S21, isolated HTTP validation probe |
| Component | `src/server.js` — JSON parsing and global error handler |

**Steps to reproduce:** POST a syntactically valid JSON expense containing a
note of 110000 ASCII characters against the local test server.
**Expected:** a controlled payload-too-large response (413), not INTERNAL.
**Actual:** 500 with error.code INTERNAL; body-parser reports entity.too.large.
**Root cause:** entity.parse.failed is handled, entity.too.large is not, so the
default 500 path replaces the parser's client-error status.
**Fix:** S23, uncommitted. `src/server.js` maps `entity.too.large` to 413
`PAYLOAD_TOO_LARGE` in the single error renderer, so the body never reaches the
UNHANDLED log. The global parser limit is unchanged; the AI draft route refuses
bodies over 8 KiB itself (400).
**Regression:** Newman `POST /transactions with a body over the parser limit →
413, not 500 (BUG-019)`; pytest `test_ai_draft_with_the_feature_off_and_an_oversized_body`.
Both assert status and code; the Newman helper also asserts "never a 500".
**→ Rule R14.**

### BUG-020 · Valid early-year dates produce malformed next dates · Medium · IN PROGRESS

| | |
|---|---|
| Found in | S21, pure date helper boundary probes |
| Component | `src/dates.js` — clampToMonth / dayAfter / nextDue |

**Steps to reproduce:** call isValidDate('0001-01-31'), dayAfter for that date
and nextDue(15, '0001-01-31').
**Expected:** accepted dates retain YYYY-MM-DD; next due is not before input.
**Actual before repair:** true, '1-02-01', '1-01-15' respectively. The latter
is earlier. At the opposite edge `9999-12-31` could become `10000-01-01`.
The same defect let schedule POST/PATCH return success and persist a row whose
computed next due was outside the declared four-digit domain.
**Root cause:** a parsed numeric year was interpolated without four-digit padding;
lexicographic comparisons then lost their fixed-width-date guarantee. The
arithmetic also had no upper-domain refusal before schedule writes.
**Fix:** local and uncommitted. Pure helpers preserve four-digit years0000–9999
and throw a coded range error for an unavailable successor. Schedule create/edit
validate computed next due before writing; a legacy edge row produces a
controlled 400 on list. No stored row is migrated or deleted.
**Regression:** initial pure controls 1/3, final 4/4; real disposable HTTP
control failed before on POST/PATCH/GET and passed after. Full contract 15/15,
340 validated responses. [Details](../qa/docs/test-report-date-boundaries.md).
Separate historical 2020–2032 matrix: 147219 checks,
0 mismatches. That matrix cannot certify years outside its range.
**→ Rule R14.**

### BUG-021 · Schedules cannot be edited through the interface · High · IN PROGRESS

| | |
|---|---|
| Found in | S21, spec-to-UI review and live Schedules inspection |
| Component | `public/app.js` loadSchedules / submitSchedule; `public/index.html` |

The steps, expected/actual result and "Fix: not applied" below preserve the
original S21 pre-repair observation; the dated update follows.

**Steps to reproduce:** create a schedule, open Schedules, try to change its
name, amount or due day using the UI.
**Expected:** Add or edit through a form, as required by spec §6.4.
**Actual:** list rows are non-interactive; the form only creates. In the probe,
2 schedule rows contain 0 buttons/links/inputs/role=button elements.
**Root cause:** PATCH exists on the API but there is no UI edit-state or update
handler wired to schedule rows. The endpoint alone does not fulfil §6.4.
**Fix:** not applied. Implement the missing UI or obtain an explicit scope
decision; do not rewrite the spec just to make the current code appear complete.
**Regression:** source and browser confirmed; add an actual schedule-edit UI test.
**→ Rule R14.**

**Local addendum, 2026-10-17:** the original observation and older §6.4
reference above remain historical. A controlled browser check first failed on
the missing Edit action. A local UI repair now provides an owned-row native
modal and uses the existing PATCH endpoint. Its first broader run exposed a
new missing-HTML-`id` implementation error; this was diagnosed from the
retained page-error trace and corrected. The final [local F09 report](../qa/docs/test-report-schedule-editing.md)
records persisted-field/lifecycle and keyboard controls plus a full managed
browser run. Scoped independent agent review accepted F09 locally on
2026-10-17. Status is **IN PROGRESS**, not CLOSED: combined-tree verification,
exact-SHA remote CI, publication and owner UAT remain. No further known
schedule-edit defect was established by that review.

### BUG-022 · Expense overlay does not contain keyboard focus · Medium · IN PROGRESS

| | |
|---|---|
| Found in | S21, keyboard and semantic inspection in Chromium |
| Component | `public/index.html` #tx-edit-sheet; `public/app.js` editor handlers |

**Steps to reproduce:** open an expense editor; press Escape; then focus Cancel
and press Tab.
**Expected:** an accessible modal editor keeps focus within its controls,
supports a clear dismiss action and restores focus after closing.
**Actual:** Escape leaves it open; Tab goes to nav-add outside the sheet.
The sheet has no dialog role or aria-modal attribute.
**Root cause:** a visual overlay is implemented without modal semantics,
keyboard containment or an Escape handler.
**Fix:** not applied. Add the appropriate dialog pattern and keyboard behaviour.
**Regression:** reproduced in browser; add semantic and keyboard regressions.
**→ Rule R14.**

**2026-10-16 local update (original observation retained):** the editor is now a
named native modal with an explicit first/last Tab wrap, in-dialog error alert,
and checked Escape/Cancel/backdrop restoration. The focused local browser and
axe evidence is in [the modal/bind report](../qa/docs/test-report-modal-bind.md).
Independent local agent code/evidence review accepted the modal repair on
2026-10-16. BUG-022 is **IN PROGRESS** pending publication and combined-tree
verification, not because another focus failure is known. This dated update
supersedes the 2026-10-13 OPEN status pointer below; the earlier “Fix: not
applied” line records its original observation, not the current source state.
No human accessibility audit, owner UAT, remote CI or release is inferred.

### BUG-023 · Registration-race violation was ignored by final verdict · High · IN PROGRESS

| Found in | 2026-10-09, in-memory race-runner negative control |
| Component | `qa/race/run.js` |

**Steps to reproduce:** make only scenario E receive 201 and 500; run the real
runner orchestration with synthetic in-memory clients.
**Expected:** E's recorded violation makes the command exit nonzero.
**Actual before repair:** E recorded one violation, but the final sum omitted E,
printed success and exited 0.
**Root cause:** a second handwritten sum did not match the scenario report.
**Fix:** local and uncommitted; one registry now drives report and enforcing
verdict, validates pair evidence, and explicitly marks D measurement-only.
**Regression:** E-only failure exits 1; each other enforcing failure exits 1;
all-good enforcing cases with D duplicates exit 0; 23/23 validator controls pass.
**→ No rule — one-off.**

### BUG-024 · Required validator inputs could disappear with a green result · High · IN PROGRESS

| Found in | 2026-10-09, in-memory filesystem negative control |
| Component | `scripts/check.js`, `scripts/coverage-gates.js` |

**Steps to reproduce:** make only `spec/architecture.md` unavailable to the
actual check functions without touching the real file.
**Expected:** missing required architecture/hash/source/UI/E2E/collection/page
object inputs make the self-check fail.
**Actual before repair:** C1 SKIP, then `OK — 7 pass, 1 skip, 0 fail`, exit 0.
Empty source/UI inventories also passed by zero iteration.
**Root cause:** scaffolding-era SKIP branches and vacuous collection loops.
**Fix:** local and uncommitted; all established required inputs and nonempty
inventories fail when absent. No production file was removed for the probes.
**Regression:** focused missing/empty controls pass; normal check is 8 pass,
0 skip, 0 fail; OpenAPI source inventory is 21/21.
**→ No rule — one-off.**

### BUG-025 · Race cleanup could remove another run's database · Medium · IN PROGRESS

| Found in | 2026-10-09, in-memory other-run sentinel control |
| Component | `qa/race/run.js` |

**Steps to reproduce:** expose another run's `race-*` file to the runner's old
cleanup seam. Do not use a real user or application database for this probe.
**Expected:** only the current run's owned temporary directory may be removed.
**Actual before repair:** the prefix sweep attempted to remove the sentinel.
**Root cause:** cleanup selected every matching name under `data/`, not an owned path.
**Fix:** local and uncommitted; allocate a unique canonical directory, validate
its parent and name, and remove only it after both children stop. If shutdown or
cleanup fails, retain the directory and return failure.
**Regression:** in-memory sentinel untouched; real disposable fixture sentinel
untouched; one real 120-pair-per-scenario run passed and removed its own directory.
**→ No rule — one-off.**

### BUG-026 · Unsafe pagination and IDs bypassed validation · High · IN PROGRESS

| Found in | 2026-10-09, real disposable HTTP contract control |
| Component | `src/validate.js`; transaction/category routes |

**Steps to reproduce:** authenticated GET `/api/transactions?offset=1e30`,
then try offset and owned IDs above `Number.MAX_SAFE_INTEGER`.
**Expected:** unsafe integers and conversion failures return 400
`VALIDATION_FAILED`; safe but absent owned IDs remain 404.
**Actual before repair:** `offset=1e30` returned 500; `9007199254740992`
returned 200 as offset and 404 as owned ID. A category object with a non-callable
`toString` returned 500. No invalid write changed the ledger.
**Root cause:** `Number.isInteger` accepts unsafe magnitudes, and `Number(raw)`
can throw on user-controlled JSON objects.
**Fix:** local and uncommitted; shared parsers require safe integers and map a
throwing conversion to a field-specific 400, retaining the limit ceiling.
**Regression:** focused before 0/2, after 2/2; full contract 14/14 and 335
validated responses; safe offset maximum and compatible keyed category casts
still pass. [Details](../qa/docs/test-report-api-validation.md).
**→ No rule — one-off.**

### BUG-027 · Non-convertible note/icon JSON returned internal errors · High · IN PROGRESS

| Found in | 2026-10-09, real disposable HTTP contract control |
| Component | `src/validate.js`; transaction/category routes |

**Steps to reproduce:** send `{ "toString": null }` or an array containing it
as expense note (unkeyed POST, keyed POST, PATCH) or category icon.
**Expected:** 400 `VALIDATION_FAILED`, no write or key reservation.
**Actual before repair:** all eight tested requests returned 500. Numeric,
boolean, ordinary object/array, null and string values still converted normally.
**Root cause:** direct `String(value)` could throw for a JSON value whose
conversion method was shadowed by client input.
**Fix:** local and uncommitted; one nullable text validator catches only failed
conversion, used in both keyed canonicalization and save without changing the
accepted payload/hash shape.
**Regression:** eight invalid responses are now 400; accepted type partitions,
keyed replay and null/omitted canonical equivalence pass. Full contract 14/14,
335 validated responses. [Details](../qa/docs/test-report-api-validation.md).
**→ No rule — one-off.**

### BUG-028 · Concurrent evaluator setup can abort before quota exercise · High · IN PROGRESS

| Found in | 2026-10-10, synchronized copied-evaluator control |
| Component | `qa/ai/evaluate.js` synthetic-user factory |

**Steps to reproduce:** start three guarded evaluator children on one disposable database, synchronized before their first get-or-create for the same synthetic email.
**Expected:** one fully initialized user and category set; all children reach provider/quota work without setup errors.
**Actual before repair:** two children reported `UNIQUE constraint failed: users.email` before provider dispatch. An injected post-seed failure separately left one user and ten categories.
**Root cause:** lookup, insert and category initialization were not enclosed in one cross-process transaction.
**Fix:** local and uncommitted; synchronous immediate transaction covers lookup through category read, and the cache receives only committed identity. Provider work remains outside it.
**Regression:** four new concurrency/report controls passed; affected tests 25/25 and full offline AI 240 passed, one Windows privilege skip. W9's rolling quota assertions are unchanged and an aborted child now has a separate diagnostic. This proves the race mechanism, not the cause of the earlier full-suite W9 failure.
**→ No rule — one-off.** [Details](../qa/docs/test-report-evaluator-concurrency.md).

### BUG-029 · Concurrent evaluator reports can overwrite each other · High · IN PROGRESS

| Found in | 2026-10-10, fixed-clock copied-evaluator control |
| Component | `qa/ai/evaluate.js` report writer |

**Steps to reproduce:** run two evaluators concurrently with the same start timestamp and inspect each printed JSON/Markdown report path.
**Expected:** each run retains its own complete report pair; a convenience latest view identifies one completed report.
**Actual before repair:** both runs printed the same path, allowing the later write to replace the earlier evidence.
**Root cause:** the basename contained only mode and millisecond start time, and writes replaced existing files.
**Fix:** local and uncommitted; add a random run identity, publish completed temporary files to exclusive final names, and make the latest view name the completed report it displays. A failed pair write cleans only its own files and does not announce success.
**Regression:** fixed-clock runs retained distinct JSON/Markdown pairs; injected second-file failure left no partial pair or success line. Two-file publication is not an atomic transaction, and latest means last completed writer, not latest start.
**→ No rule — one-off.** [Details](../qa/docs/test-report-evaluator-concurrency.md).

### BUG-030 · Stale or redundant static-gate exceptions passed C9 · Medium · IN PROGRESS

| Found in | 2026-10-10, in-memory exception negative controls |
| Component | `scripts/coverage-gates.js`, `scripts/check-exceptions.json` |

**Steps to reproduce:** add a valid-looking C6 route, C7 testid or C8 status exception that is absent from the current inventory; add an already-addressed or duplicate entry; try an invalid entry shape.
**Expected:** C9 fails with a specific stale, redundant, duplicate or invalid-entry diagnostic; unavailable required inventories fail without false stale claims.
**Actual before repair:** C9 checked reason length only. The initial control run had 23 passed and 6 failed; malformed data could throw outside the intended gate verdict.
**Fix:** local and uncommitted; C9 uses the same current inventories as C6–C8, validates shape/reason/identity, and keeps malformed entries from crashing the other gates.
**Regression:** final independent local `test:gates` 31/31 and `check` 8/8; original input hashes were unchanged by in-memory controls. The one current `500` exception remains an explicit unexercised static gap, not a runtime waiver.
**→ No rule — one-off.** [Details](../qa/docs/test-report-static-gates.md).

### BUG-031 · Static inventory gate wording overstated runtime coverage · Medium · IN PROGRESS

| Found in | 2026-10-10, comparison of gate wording with real-response matrix |
| Component | `scripts/check.js`, `scripts/coverage-gates.js`, QA documentation |

**Problem:** C6–C8 scan source and test text. Their former names and messages could be read as proof that a request executed, a selector worked on a rendered page, or each operation/status branch was provoked. C8 in particular matches status assertions globally.
**Expected:** static declaration checks and real execution evidence are named separately.
**Fix:** local and uncommitted; gate names, diagnostics and current documentation now say STATIC. The observed contract operation/status matrix retains its NOT EXERCISED cells; no behavioral coverage is inferred from these gates.
**Verification:** independent local `check` 8/8, plus contract tests 15/15 with 340 validated real HTTP responses. This does not turn all matrix cells into exercised cases.
**→ No rule — one-off.** [Details](../qa/docs/test-report-static-gates.md).

### BUG-032 · CI and local verification diverged; API/Python reports were not retained · Medium · IN PROGRESS

| Found in | 2026-10-10, source comparison of workflow, package scripts and report producers |
| Component | CI workflow, verification commands and QA evidence retention |

**Problem:** the published baseline CI omitted the race layer, while `npm test` excluded several CI suites. An earlier local edit added race, but no shared plan kept local and CI groups aligned. Newman HTML/JUnit and Python JUnit were generated without CI upload steps.
**Expected:** an explicit CI-equivalent plan with fail-closed prerequisites and retained allowlisted reports on success or failure.
**Fix:** local and uncommitted; shared six-group/18-task inventory, fail-fast runner with `NOT_RUN` statuses and ignored compact identity summary, plus v4 upload steps for staged API/Python/race evidence. Existing browser failure traces and seven-day retention remain.
**Verification:** nine focused controls pass. The isolated API group passed 10/10 tasks; Python passed 27/27 items. The default local plan failed at missing `gitleaks` and correctly left 17 tasks `NOT_RUN`. Full local/remote CI and actual upload behavior are **not verified**.
**Review addendum:** the earlier nine-control suite could falsely accept E2E's wrong dependency by matching the next job and falsely reject an equivalent CRLF workflow. The first same-helper regressions observed 9 pass / 2 fail; the bounded job check now passes 12/12, including wrong-edge, CRLF and unsupported-form cases. The actual workflow was already correct; real groups were not rerun. Tracked deletions can fail identity before a summary, children have no wrapper timeout, provenance is invocation-only, local CI flags can differ, and privacy screening remains heuristic. This local repair does not establish remote artifact uploads or close this IN PROGRESS finding.
**Line-ending fixture follow-up:** a full read-only virtual CRLF view exposed two LF-only mutation fixtures before helper invocation (10 pass / 2 fail). They now normalize before mutation and exercise both LF and CRLF forms without changing the workflow. Final selected controls pass 12/12 on actual LF and 12/12 on virtual CRLF; wrong-dependency and ambiguous-form negatives remain enforced. No real group or remote CI was rerun, so this finding stays IN PROGRESS.
**→ No rule — one-off.** [Details](../qa/docs/test-report-ci-verification.md).

### BUG-033 · Main E2E reused one database between runs and ignored DB_PATH · Medium · IN PROGRESS

| Found in | 2026-10-11, main Playwright configuration and focused negative control |
| Component | `playwright.config.js`, managed main E2E runner |

**Problem:** the prior config always selected `data/e2e.db`, regardless of a
caller-provided `DB_PATH`, so repeated suite invocations used a persistent
database. No observed 429, measured growth or data loss is asserted here.
**Expected:** a fresh default database for every main E2E invocation and a
safe explicit override; cleanup only after the owned server stops.
**Fix:** local and uncommitted. A parent runner outside browser specs owns both
children and a unique temporary directory, refuses existing/protected override
paths and external targets, and removes only its owned default after confirmed
child closure. Explicit new files remain with the caller. No application or
browser-spec assertions changed.
**Regression:** initial 0/5 included one real fixed-path failure and four
missing-runner harness failures; after the first implementation 4/5, with old
wiring remaining. Final focused Node controls 24/24 and static check 8/8 after
structural relocation and an actual retained-override control. One full local
main E2E run passed 192/192 across
phone and desktop, with confirmed server closure and owned-default cleanup;
old DB length/mtime stayed the same and the app DB remained absent. Remote CI
is not yet claimed. Forced parent termination may leave temporary data;
fixed-port parallel commands remain unsupported by default.
[Details](../qa/docs/test-report-e2e-isolation.md).
**→ No rule — one-off.**

**BUG-033 sidecar addendum, 2026-10-11:** the first explicit-path guard refused
sidecar *names* as `DB_PATH` but accepted a new base next to an existing
`-wal`, `-shm` or `-journal`. Disposable probes reproduced all three without
opening SQLite. A failing-before control exposed `-wal`; the local correction
now refuses all three via `lstat` before `wx`, with no base or child start and
unchanged sidecar sentinel bytes/identity. Affected controls: 26 pass, 1
optional dangling-symlink fixture skipped for Windows privilege, 0 fail;
static check 8/8. The earlier full 192/192 browser result was **before** this
guard, not a run of the newest tree. Concurrent sidecar creation after preflight
remains a TOCTOU limit; remote CI is still unverified.

### BUG-034 · Declared Node floor could load an incompatible native binding · High · IN PROGRESS

| Found in | 2026-10-11 runtime compatibility controls |
| Component | package engine, CI Node baseline, database bootstrap |

**Problem:** `>=22` accepted Node 22.9 while the installed SQLite binding
requires Node-API 10, first available in the 22 line at 22.14. The observed
native crash is consistent with this mismatch; the exact native failure cause
was not isolated.
**Expected:** truthful metadata and CI floor, plus a clear error before loading
the native binding or creating a data directory on an unsupported runtime.
**Fix:** local and uncommitted; the package and lock root use
`^22.14.0 || >=23.6.0`, CI pins 22.14.0, and the database bootstrap calls a
built-in-only stable-version/Node-API guard first.
**Regression:** focused [runtime controls](../qa/docs/test-report-runtime.md)
failed before the fix and cover the version/API boundaries, workflow wiring
and child-process import order. The exact final local results are in that
report. Full remote CI and future-version compatibility remain unverified.
**→ No rule — one-off.**

### TRACE-AUDIT-001 · Public semantic traceability drift · IN PROGRESS

| Found in | 2026-10-12, F13 read-only inventory and bounded local repair |
| Component | Public architecture references, case catalogue, feature-rule anchors and AI risk table |

**Observation:** the 280-row catalogue used retired architecture clause
numbers, and some AI risk links pointed at real IDs with different meanings.
Existence of an ID alone did not prove semantic traceability. The synthetic
import analysis is still explicitly provisional.

**Local repair:** a public core-rule migration index, stable anchors on
existing feature-rule sources, corrected catalogue and AI-plan links, plus a
standalone built-in-only static identity/link checker with negative controls.
The two authorized architecture edits and paired SHA are reviewed in the
[F13 report](../qa/docs/test-report-traceability.md). No historic case
result was rerun or changed.

**Verification:** local Node 22.14.0: 17/17 new static controls, 280 case
IDs / 78 rule definitions in the standalone checker, and existing
`scripts/check.js` 8/8. Static identity cannot establish case meaning,
executed coverage, owner acceptance or a new CI result. Independent main/
Critic review and publication remain pending. **Do not mark FIXED** from this
local result.

**ORD-087 independent-review addendum, 2026-10-12 — IN PROGRESS:** the
ORD-086 review withheld local F13 acceptance for four semantically wrong
monthly-limit links (TC-API-096–099) and a source-definition parser that
accepted an extra anchored CORE-999. The four links now target REQ-ML-05.
An in-memory CORE-999 control failed before the parser repair (17 pass /
1 fail); bounded source-family, LF/CRLF and wrong-family controls were added
without promoting repeated references to definitions. Latest focused
results and artifact hashes are in the
[F13 report](../qa/docs/test-report-traceability.md). This addendum does
not change historical statuses, establish runtime behavior or close the
audit; independent follow-up and publication remain pending.

<!-- F20-F21 status addendum begin -->
### F20/F21 status correction — 2026-10-13

This is an additive current-state note, **not** a rewrite of the original
observations or recorded outcomes above. The `S23 · uncommitted` Fix cells and
paragraphs for BUG-014/019 describe their recording time. Local Git history
places both fixes in the public-ready root `2face59`: the short-phone CSS is
present in `public/style.css`, and `src/server.js` maps `entity.too.large` to
413. The accessibility/Escape/focus-restoration source and CI workflow wiring
are in later local committed HEAD `b270355`; no new full remote CI result for
the **currently uncommitted combined tree** follows from either commit.

BUG-022 stays **OPEN**: Escape dismissal and focus restoration now have bounded
local browser checks in the [dated accessibility baseline](../qa/docs/accessibility-baseline.md),
but a full modal focus-containment/semantics regression and owner review are
not established. BUG-021 stays **High/OPEN** and blocks release without a
recorded owner exception; other High findings marked IN PROGRESS are not
automatically cleared by local repairs. BUG-005 stays Low/OPEN with unknown
cause. A focused
readiness retry did not establish the cause of the earlier failed check; see
the [runtime report](../qa/docs/test-report-runtime.md). Developer regression,
release and UAT gates are separate in the [test plan](../qa/docs/test-plan.md).
The [current-state index](../docs/qa-status.md) distinguishes local proof,
historical publication and pending acceptance. No statuses in the original
register are changed by this note.
<!-- F20-F21 status addendum end -->

### F22 retry/busy assurance addendum — 2026-10-13

The [focused local report](../qa/docs/test-report-retry-busy.md) records an
uncommitted TC-E2E-045 test that holds the response to a real persisted POST,
attempts a native second click while Save is busy, and verifies one request,
one persisted expense and one Month row. A bounded browser-response mutation
of both busy protections makes that assertion fail; the product file was not
edited. TC-E2E-047 still verifies that a deliberate second Save creates a
second row. CI's one retry is diagnostic only: a retry-only pass is flaky and
nonzero, with a first-failure trace and a fresh JSON evidence identity. This
does not prove BUG-005's cause, every possible concurrency failure, a new
remote CI result, release acceptance or owner UAT. Historical observations
and statuses above remain unchanged.

### BUG-035 · Offset paging can duplicate or skip expenses after another client's write · Medium · IN PROGRESS

**Found in:** 2026-10-16 disposable HTTP and two-viewport browser controls.
**Steps:** read the first expense page; insert a newer row from a second client,
then use `offset=2` for the next page. In a separate run, delete a seen row
before continuing with the old offset.
**Expected:** every surviving unseen expense appears once; a changed live total
does not produce an impossible Month counter.
**Actual before repair:** HTTP insertion repeated the already seen boundary ID;
HTTP deletion skipped an unseen surviving ID. In the browser, insertion
rendered 52 of 52 instead of restarting, while deletion showed a deleted row
instead of the remaining unseen one. Both phone and desktop witnesses failed
as expected.
**Cause:** a numeric offset follows the shifted current list, not the last
seen `(spent_on, id)` position.
**Local repair:** optional cursor mode applies a parameterized keyset predicate
with account/filter-bound, strictly checked tokens. Legacy offset callers keep
their accepted response and behavior. Month uses cursor continuation and makes
one first-page restart when the live total changes; it does not poll.
**Regression:** focused synthetic HTTP controls 2/2, full local contract
17/17, managed pagination browser 8/8, editing 18/18 and focused editor/a11y
4/4 after a separate port-collision harness retry. This is not an immutable
snapshot: edits moving sort position, same-total external mutations and cached
rows remain limits. Independent agent code/evidence review accepted this
bounded local repair on 2026-10-16; BUG-035 remains **IN PROGRESS** for
combined-tree verification and publication, not because another known
insertion/deletion failure remains. No human audit, owner UAT, remote CI or
release is inferred. [Analysis](../qa/docs/analysis-pagination-consistency.md) ·
[run report](../qa/docs/test-report-pagination-consistency.md).

## F06/F10 local recovery and request-lifecycle addendum — 2026-10-17

The bounded local batch reproduced three pre-repair browser failures: a real
committed Save and Pay each lost its browser reply without same-key recovery,
and an older Month response replaced a newer total. The opted-in keyed Pay
server branch, ordinary Save recovery records, session/screen ownership and
finite response-body deadline now have focused local controls. A separate
auth-to-app busy-ownership regression found during the batch was repaired and
tested. [Contract and exact results](../qa/docs/test-report-write-lifecycle.md).
An earlier 210-test managed core run passed 204/210; Pay-refusal and app-start
navigation regressions were repaired in focused checks, while one short-toast
failure had no established cause. A later 218-test run passed 217/218 because
one desktop fixture navigation aborted before its scenario; that scenario
passed 2/2 separately. A final, separate full run passed 218/218 with four
workers. Scoped independent agent review accepted F06 and F10 locally on
2026-10-17: **23/25 (92% by finding count)**. This does not alter historical
BUG states or prove the earlier failures flaky. Combined-tree verification,
exact-SHA remote CI, publication and owner UAT remain open.

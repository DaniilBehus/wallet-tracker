# BUG-004 · Twenty wrong passwords a second make the app unusable for everyone

![severity](https://img.shields.io/badge/severity-High-orange?style=flat-square)
![state](https://img.shields.io/badge/state-CLOSED-brightgreen?style=flat-square)

| | |
|---|---|
| **Severity** | High |
| **Priority** | P0 — an unauthenticated request makes the whole service unusable |
| **State** | CLOSED 2026-09-03 |
| **Found by** | TC-LOAD-002, `qa/load/auth-burst.js` (k6) |
| **Component** | `src/auth.js` — `login`, `bcrypt.compareSync` |
| **Affects** | every endpoint, including `/api/health` |
| **Environment** | Node v24.13.1, local server on port 3100, throwaway database |
| **Fixed in** | Fixed. The original commit is not part of this public snapshot. |
## Summary

Twenty failed logins a second — a rate one phone on a bad connection could
produce by accident — take `GET /api/health` from 1.2 ms to 1819 ms at p95.
That endpoint runs one `SELECT 1`, touches no user data, and has nothing to do
with logging in.

Nobody needs an account to cause it. No token, no prior relationship, and until
the fix, no limit on attempts.

## Steps to reproduce

1. `npm run test:load` — it starts its own server on port 3100 against a
   throwaway database, so nothing else on the machine is touched.
2. The second scenario registers one account, then sends wrong passwords for it
   from 20 connections at once for 15 seconds.
3. Throughout, `GET /api/health` is polled ten times a second and timed. It is
   also measured for five seconds beforehand, so there is a baseline to compare
   against rather than an impression.

## Expected

`/api/health` stays fast while other requests are in flight. The load smoke's
threshold is `p(95) < 250 ms`, already generous for a request that does one
trivial query.

## Actual

<details>
<summary>k6 output — the failing run</summary>

```
login attempts    305 in 15s  (20/s)
refused 401       305
rate limited 429  0        <- nothing stops a guesser yet
login latency     avg 1017.8 ms   p95 1099.1 ms

GET /api/health - the same trivial request, measured twice:
  idle            avg 0.8 ms      p95 1.2 ms
  under load      avg 1134.9 ms   p95 1819.1 ms
  cost of load    1494.8x slower at p95

ERRO thresholds on metrics 'health_latency_under_load' have been crossed
```

</details>

**1.2 ms → 1819 ms.** Every other user waits nearly two seconds for a request
that should take one millisecond.

## Root cause

`src/auth.js` called `bcrypt.compareSync`.

bcrypt is *designed* to be expensive — that is the whole point of it, and ten
rounds costing ~50 ms is correct and must not be lowered. The defect is the
**`Sync`**.

Node runs JavaScript on one thread. A synchronous call does not compute
*alongside* other requests, it computes *instead of* them: for those ~50 ms the
process cannot accept a connection, parse a request, or answer anything at all.
Twenty concurrent attempts do not share the cost — they queue behind each
other, and everybody else queues behind the lot.

Two things make it worse, and each has its own fix, which is why they are named
separately:

- **The endpoint is unauthenticated.** No account and no token is needed to make
  the server spend 50 ms of CPU.
- **Nothing limited attempts.** 305 were made and 305 were processed.

`register` had the same shape (`bcrypt.hashSync`), and the write smoke measured
it from the other side: setting up 50 accounts took 2800 ms, ~56 ms each,
strictly one after another.

**Not the same as [LIMIT-001](LIMIT-001-serialised-database-work.md).** That one
queues behind ~0.5 ms of database work and costs 23×. This queues behind ~50 ms
of deliberate CPU burn and costs 1495×. Same mechanism, two orders of magnitude
apart — which is why one is an accepted limit and this is a defect.

## Fix — part one, the limiter

Per **D-016**: five failures inside a 15-minute window, then 429 with
`Retry-After`, counted against the e-mail and the client IP independently.
`src/ratelimit.js`, called from the login route **before** `login()` runs.

That ordering *is* the fix. The entire cost of this defect is bcrypt, so a
limiter placed after it would have protected nothing at all.

<details>
<summary>Regression — same script, same 20 connections, same 15 seconds</summary>

```
                     before            after
login attempts       305               113 062
reached bcrypt       305               5          (the allowance)
rate limited 429     0                 113 057
login latency avg    1017.8 ms         2.6 ms
health p95 idle      1.2 ms            1.2 ms
health p95 loaded    1819.1 ms         5.3 ms
                     1495x slower      4.5x slower
threshold            CROSSED           passes
```

</details>

Throughput rising from 20/s to 7 537/s is itself evidence the limiter sits in
the right place: refusing became cheap because it now happens before the
expensive part.

Boundary behaviour is covered by the API collection, folder **08 · Login rate
limiting** — the last allowed attempt, the first refused one, `Retry-After`,
the correct password not bypassing the block, the window lifting by itself, and
a successful login clearing the counter.

## Fix — part two, the residual

The first fix left a residual, stated at the time rather than glossed over:
each of the five allowed attempts still blocked the event loop for ~50 ms. It
stood for two sessions as prose, and **it had never been measured** — the burst
script cannot see it, because after five attempts everything is a cheap 429, and
the limiter hides the expensive part behind itself.

So a third script was written, `qa/load/allowed-logins.js`, which runs against a
server whose limiter is switched off (`LOGIN_MAX_FAILURES` set very high). That
is not a realistic deployment; it is the only way to ask what the *allowed*
attempts cost.

The answer was worse than the prose had suggested.

<details>
<summary>k6 output — five concurrent logins, all reaching bcrypt</summary>

```
                                                   before          after
  attempts completed in 15s                        285             1103
  login latency, avg                               265.5 ms        67.9 ms
  GET /api/health  idle p95                        1.5 ms          1.5 ms
  GET /api/health  under load p95                  422.4 ms        1.0 ms
                                                   285.8x slower   0.7x
```

</details>

**Five wrong passwords — inside the allowance, from one person mistyping — made
every other request take four tenths of a second.**

`src/auth.js` moved to `bcrypt.hash` and `bcrypt.compare`. `register()` and
`login()` became `async`, and so did the two routes that call them. bcrypt is
unchanged at ten rounds — the cost *is* the security property. What changed is
where it is paid: on a libuv thread-pool worker instead of the event loop, so
one login occupies a worker rather than the whole process. Express 5 forwards a
rejected promise to the error handler by itself, so the single error renderer in
spec §5 still sees everything and no route grew a `try/catch`.

Login latency also **fell**, from 265 ms to 68 ms, and throughput went from 285
to 1103 in the same fifteen seconds — about four times, which is the default
thread-pool size.

## The ordering that had to survive, and did

`rateLimit.check()` is still the first thing the login route does, before
`await login(...)`. Reversing them would hand back the whole of this defect.

Asserted **structurally, not by timing**: TC-API-071 sends the *correct*
password while blocked and still requires 429 — which is only possible if the
check runs before authentication. A timing assertion would have been the obvious
way to write this and the wrong one: it would fail on a slow CI machine for
reasons that have nothing to do with the property being protected.

## Regression

`qa/load/allowed-logins.js` keeps a threshold of
`health_latency_under_load: p(95) < 100`. Synchronous bcrypt cannot hold it —
it measured 422 ms. It now passes at 1.0 ms.

## → Rule R6

Measure the same cheap endpoint idle and under load **in one run**. A latency
number with nothing to compare it against says nothing; the ratio is the
finding.

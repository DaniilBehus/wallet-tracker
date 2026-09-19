# Test design · WALLET

**How a change becomes a set of tests — the same way every time.**

This is not a checklist of good intentions. It is nine steps that take a
feature as input and produce a list of cases as output, so that two people
running it on the same change would write roughly the same tests, and so that a
gap is something somebody decided rather than something nobody thought of.

Every step below is illustrated with something from this application. A step
with no example is a step nobody has actually used.

**The order matters.** Steps 1–4 are mechanical and produce most of the cases.
Steps 5–8 need judgement and produce the interesting ones. Step 9 is the one
that is skipped, and it is the one that makes the rest honest.

Three gates in `scripts/check.js` watch the output of this process — **C6**
routes, **C7** testids, **C8** statuses. They cannot check that a test is
*good*; they check that nothing was silently left out.

## Applied independently · Python/pytest (D-032)

The Python layer does not repeat the Postman request inventory. It applies the
same design to a different client and shapes the cases around what parameterized
fixtures do well: one invalid-field matrix, malformed JSON, the four rejected
token forms, ownership as both invisible read and refused change, and two
stateful lifecycles. The fixture itself is part of the test design: it starts
the real Node process, waits for health, and owns a temporary database, port and
secret. A test that passed only because another server was already listening
would be evidence about that server, not this application.

---

## 1 · Inventory of what changed

List every artefact the change touched, by kind. Not "the income feature" — the
actual surfaces, because each kind has its own tests.

| Kind | Ask |
|---|---|
| Table or column | new constraints, new defaults, a new nullable |
| Endpoint | method, path, request shape, response shape |
| Response field added to an **existing** endpoint | every consumer, and every schema that describes it |
| Validator | what it accepts and what it refuses |
| State a row can be in | and every transition between those states |
| Rendered element | its testid, and the flow it belongs to |

**Worked example — monthly income (D-021):**

```
table      settings(user_id PK, monthly_income_cents INTEGER NOT NULL
                    DEFAULT 0 CHECK (monthly_income_cents >= 0))
module     src/settings.js          readIncome, writeIncome
endpoints  GET /api/settings        PUT /api/settings
changed    GET /api/summary         + income_cents, + remaining_cents
validator  validate.incomeCents     integer, 0 .. 100 000 000
elements   income-value  income-edit  income-input  income-save
           income-cancel  month-remaining  remaining-label
```

The line that is easiest to miss is the third. Adding two fields to
`/api/summary` broke three existing assertions the moment it landed — because
every schema in the collection sets `additionalProperties: false`. That was the
inventory step happening automatically, and it is the only step that has a
machine doing it for you.

---

## 2 · Equivalence classes and boundaries, per field, by type

For each field, partition its inputs into classes where every member is
expected to behave the same, then test **one from each class and both sides of
every boundary**. The partition follows from the field's type, so this step is
mechanical.

| Type | Classes to cover |
|---|---|
| Integer with a range | below min · min · min+1 · typical · max−1 · max · above max · not an integer · wrong type · missing · explicit null |
| String with a length limit | empty · whitespace only · 1 char · limit · limit+1 · wrong type · missing |
| Date as text | valid · wrong format · shaped-but-impossible (`2026-13-45`) · outside the allowed window · missing |
| Enum-like integer (day of month) | below · lowest · a value needing no special handling · the value that triggers the special case · above |
| Optional field | absent · null · present · present and invalid |
| Foreign key | own · another user's · nonexistent · not a number |

**Worked example — `amount_cents`, from spec §4.3:**

```
0             -> 400   TC-API-023   below the minimum
1             -> 201   TC-API-024   the minimum
100 000 000   -> 201   TC-API-025   the maximum, exactly
100 000 001   -> 400   TC-API-026   one past it
12.5          -> 400   TC-API-027   integer cents means integer
"1250"        -> 400   TC-API-028   no coercion
absent        -> 400   TC-API-029
```

**And the one that matters most in this app:** `day_of_month` is not a plain
1–31 range. 28 exists in every month and 31 does not, so the partition is
`{0} {1} {2..28} {29,30,31} {32}` — five classes, not three. The clamping rule
in §4.1 lives entirely in the fourth. A test using 15 would prove nothing about
it.

---

## 3 · Authentication matrix

Five token states × two ownerships. Fifteen boxes, most of which collapse — but
they collapse **on purpose and in writing**, not by being forgotten.

| | own resource | another user's |
|---|---|---|
| valid token | the feature's happy path | **404, and asserted not to be 403** |
| no token | 401 | 401 (never reaches ownership) |
| malformed header | 401 | 401 |
| corrupted signature | 401 | 401 |
| expired | 401 | 401 |

**The legitimate collapse:** the middleware runs before every protected route,
so the four failing token states are asserted **once**, against `/categories`
(folder 02), and not repeated for each endpoint. That is a decision; it is
written here so that nobody re-derives it as an oversight.

**What does not collapse:** the *own vs another user's* column. Every endpoint
that takes an id has to be asked separately, because ownership is enforced per
query, not by middleware. Six cases in this collection do that, and each also
asserts the answer is **not** 403 — a 403 would confirm the row exists, which
turns id enumeration into a map of somebody else's data (§4.3).

**The expired token needs manufacturing.** Tokens live 30 days, so `qa/api/run.js`
signs one with the server's own secret and an `exp` in the past. The case
asserts the token really has expired *before* asserting the 401 — otherwise it
would pass against any unusable string and prove nothing about expiry.

---

## 4 · Error contract: every status the code can produce

List every status the changed code can return, then write a case that
**provokes** each one. Not "checks it would return"; makes it happen.

**C8 enforces this** by reading `res.status(...)` and `new ApiError(...)` out of
`src/` and looking for a matching assertion in the collection.

Currently: **10 statuses produced, 8 asserted, 2 excepted with reasons.**

```
200 201 204 400 401 404 409 429   asserted
500                               excepted — §5 says it must never be reachable.
                                  Provoking one means breaking the app to prove
                                  it can break. 40+ assertions check the
                                  opposite: "never a 500".
403                               excepted — unreachable by design. validate.js
                                  exports forbidden() and nothing throws it;
                                  §4.3 requires 404 instead. TC-API-066 asserts
                                  the property that replaced it.
```

Both exceptions live in `scripts/check-exceptions.json` with those reasons.
**An exception is for something that cannot be tested, never for something that
has not been tested yet.**

---

## 5 · State transitions, legal and illegal

Draw the states a row can be in and every arrow between them — then test the
arrows that should not exist, because those are the ones nobody implements.

**Worked example — a loan (§4.2):**

```
        pay              pay              pay
active ─────> active ─────> active ─────> finished
  │  n of N     n+1 of N      N-1 of N     active = 0
  │                                            │
  └──────────────── pay ───────────────────────┘
                                          409, not 400
```

| Arrow | Case |
|---|---|
| pay, not the last | TC-API-054 — `finished: false` |
| pay, the last | TC-API-056 — `remaining_count` 0, `finished` **true** |
| **pay a finished loan** | TC-API-057 — **409**, asserted not to be 400 |
| the finished row leaves `?active=1` | TC-API-058 |
| pay somebody else's | TC-API-059 — 404 |

The third row is the one worth the effort. It is a **state** conflict, not bad
input, and 400 would be the easy wrong answer. The spec calls it out precisely
because it is easy to get wrong.

**A transition has a second question, and it is the one nobody asks:
who wins when two of these arrows are drawn at the same moment?**

Every arrow above is written as though one actor moves the row. Two tabs, two
devices, or a retried request make that false, and the state machine says nothing
about it. That is not a gap in the drawing — it is a gap in the *specification*,
and finding it is worth more than covering another arrow. See §8: this project
had no written rule for it, and the concurrency layer was built to find out what
the answer actually was.

**Same shape, elsewhere:** the rate limiter (D-016) is a state machine too —
under the limit → at the limit → blocked → expired. The interesting arrows are
"the correct password while blocked" (still 429, or the limit protects nothing)
and "blocked → unblocked with nobody intervening" (or an e-mail address becomes
a way to lock its owner out).

---

## 6 · Decision table for combinations

When two or more conditions interact, tabulate them. Do not test the
combinations that occurred to you; enumerate them and then decide which to
cover.

**Worked example — income × spending, the month screen:**

| # | income | spent | expected |
|---|---|---|---|
| 1 | not set | nothing | `Set income`, remainder `—` |
| 2 | not set | some | `Set income`, remainder `—`, donut still draws the spend |
| 3 | set | nothing | Left = the whole income, no arcs |
| 4 | set | less than income | Left = income − spent |
| 5 | set | **exactly** the income | Left = `€0.00` — not `Over €0.00` |
| 6 | set | more than income | label flips to `Over`, figure is the excess |

Row 5 is the boundary between rows 4 and 6 and is the one a person writing
tests by intuition skips: it feels like row 4 and behaves like the edge of row
6. Rows 2 and 3 are the "one condition present, the other absent" pair that a
happy-path suite never reaches.

This table is not an illustration. Running it in S11 found rows 2, 3 and 5
untested — see §Retrospective below.

---

## 7 · Interface: every testid, both paths per flow

- **Every testid the app renders is addressed from a page object.** C7 enforces
  it. A locator in a spec file is a locator outside the one place D-012 says
  they live, and it is the first step back to selectors scattered everywhere.
- **Every flow gets a happy path and a refused path.** Saving with no amount,
  saving with no category, an income that is not a number, a payment the server
  rejects. The refused paths are where BUG-003 was found — the success path
  re-rendered the screen and hid the damage.
- **Select by role and name as well as by testid** where the name is the point.
  A category tile found by `getByRole('button', { name: 'Groceries' })` fails if
  the tile loses its accessible name; found by testid, it does not.
- **Assert the number, not the picture.** The donut is asserted as "one arc per
  category, addressable by category id" plus the figures beside it. Asserting
  arc geometry would test the arithmetic of `stroke-dasharray`, which is not
  where the money is.

---

## 8 · Concurrency, repetition, server failure

Three questions the single-user happy path never asks.

| Question | In this app |
|---|---|
| What happens under parallel load? | `qa/load/` — 50 concurrent writers, and a burst of failed logins. This is how **BUG-004** was found: 20 wrong passwords a second took `/api/health` from 1.2 ms to 1819 ms |
| What happens on repetition? | A second `PUT /api/settings` must replace, not accumulate (TC-API-076). A second `DELETE` must 404, not 204 (TC-API-041). A second payment on a closed loan must 409 |
| What happens when the server refuses? | **BUG-003** exactly: the screen handled the 409 correctly and left the button reading `Paying…` for ever. Every action that can be refused gets a case where it is |

**Measure against a baseline or measure nothing** (R6). Every load run records
`GET /api/health` idle *and* under load in the same run. "20 ms" means nothing;
"1.4 ms → 32 ms" is a limit and "1.2 ms → 1819 ms" is a defect.

---

### 8a · Two actors, one row — the class this project was missing

Added later, on an explicit request. It belongs here rather than
in §5 because it is not another arrow on the state machine; it is the question of
what happens when two arrows are drawn at once.

**Start by looking for the rule, not the bug.** Before writing anything, ask:
*does the specification say who wins?* For this app the answer was **no** — §4.2
describes paying a loan and §5 describes editing one, and neither says a word
about both happening together. **That absence is the first finding**, and it is
worth more than a test, because a test can only check an answer that exists.

**Then find out where the safety actually comes from.** It is rarely where you
would guess. Here:

| | |
|---|---|
| What the code looked like | a read, then a decision, then a write in a separate transaction — a textbook time-of-check-to-time-of-use gap |
| Why nothing had ever gone wrong | `better-sqlite3` is synchronous and Node runs one thread, so a handler with no `await` cannot be interleaved. The event loop serialises requests before SQLite sees them |
| Why that is not good enough | it is a property of the runtime, not of the code. Two server processes on one file break it, and so does one `await` added to a route — `src/auth.js` already has one |

**Safety by accident of the runtime is not safety.** It cannot be reviewed, it
does not appear in a diff, and it fails silently when the accident stops holding.

**Write the invariants, not the expected output.** A race has no expected value —
that is what makes it a race. It has outcomes that are *allowed* and outcomes
that are *impossible*:

| | Allowed | Impossible |
|---|---|---|
| pay vs edit | the payment charges the old amount, or the new one | `paid_count` moving by anything but one; a charge for an amount never set; a finished loan with instalments left; any 5xx |
| edit vs delete | edit lands then the row is deleted; or the row is gone and the edit answers 404 | the row surviving a successful delete; any 5xx |

**Run it against more than one process.** This is the step that earned the whole
exercise. Within one process, forty pairs of pay-vs-edit were clean — the
serialisation argument held exactly as reasoned. Across two processes sharing one
database file, the same forty pairs produced **four 500s** (BUG-012) and the
servers could not even start together (BUG-011). Neither was reachable from any
existing layer, because nothing had ever created the condition.

**Check that the race is actually racing.** `qa/race/` scenario B reported forty
identical outcomes — `edit 404 · delete 204`, every time. Forty observations of
one fixed ordering is not a race being tested; it is one branch being tested
forty times, and the other branch not at all. Swapping the request order changed
nothing, which disproved the obvious explanation. The legal-but-unreachable
branch is now covered by a **forced** ordering, labelled as forced, because a
suite that never reaches a branch and a suite that reaches it on purpose look
identical in a pass count.

**Repetition belongs here too, and the answer can be "correct, and still worth
knowing".** Two identical POSTs create two rows, forty times out of forty. That
is HTTP behaving as specified. The question that decides whether it matters is
the *next* one — can a person reach it? — and the answer was no, because
`withBusy` disables the control before the first request is awaited. Both halves
are in LIMIT-002. A finding that turns out to be correct behaviour is still a
finding, provided the protection is named rather than assumed.

---

## 9 · What is deliberately not tested

The step that gets skipped, and the one that makes the other eight honest. An
untested area is either a decision with a reason or an oversight, and the only
difference is whether it is written down.

| Not tested | Why |
|---|---|
| Cross-browser | Chromium only, two viewports. The app uses no API that varies between engines, and one browser actually run beats four that are aspirational |
| Visual regression | No baseline screenshots. Layout is asserted through geometry and accessible names instead. BUG-001 is the counter-argument and is answered by TC-REG-001, which reads the computed contrast rather than comparing pixels |
| Unit tests | Spec §7 keeps the only real algorithm (`dates.js`) pure, and the API layer exercises all seven rows of its §4.1 table from outside. A unit layer would re-test the same function by a shorter path |
| Concurrent writes to one user's settings | `user_id` is the PRIMARY KEY and the write is a single upsert, so SQLite serialises it. **"From one process" was doing more work in this sentence than anyone noticed** — §8a is what happened when the assumption was tested across two |
| Dependencies (Express, bcrypt, …) | Third-party code with its own suites |
| The four failing token states, per endpoint | Collapsed deliberately — see §3 |
| 500 and 403 | See §4. Both in `check-exceptions.json` with reasons |

---

## Retrospective — the procedure run against a finished feature

**S11 ran the income feature (D-021) back through steps 1–9 to test the
procedure rather than the feature.** It had already shipped with 13 API cases
and 8 end-to-end cases, all passing.

It found **seven gaps**, and where they came from is the useful part:

| Step | Gap | Added as |
|---|---|---|
| 2 · boundaries | `monthly_income_cents` = 1 — the minimum-plus-one class had no case | TC-API-087 |
| 2 · boundaries | = 100 000 000 — the ceiling itself; only ceiling+1 was tested | TC-API-088 |
| 2 · boundaries | explicit `null` — distinct from absent, and it took a different path through the validator | TC-API-089 |
| 3 · auth matrix | `PUT /api/settings` with no token — only `GET` had been asked | TC-API-090 |
| 6 · decision table | row 2: spending with no income set | TC-E2E-042 |
| 6 · decision table | row 3: an income with nothing spent | TC-E2E-043 |
| 6 · decision table | row 5: spending **exactly** the income — the boundary between "Left" and "Over" | TC-E2E-044 |

Five of the seven come from the two mechanical steps. That is the argument for
this document existing: they are not clever cases, they are the ones that fall
out of following a partition to the end, and every one of them was missed by
someone writing tests thoughtfully but by hand.

None of the seven found a defect in the application. That is a result too — the
feature was right, and now the suite can prove more of it.

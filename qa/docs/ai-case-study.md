# Case study — putting a language model next to money, and keeping it honest

Wallet is a small phone-first expense tracker: a keypad, category tiles, Save.
The project added an optional way in: type *"Учора витратив 18 євро на обід"* and get a
form filled in for you — €18.00, Restaurants, yesterday, "обід" — which you
check and save yourself.

This page is about the testing, not the feature. The interesting question was
never "can a model read that sentence". It was: **what has to be true so that
when the model is wrong, nothing bad happens, and when the tests are green, that
means something?**

## The problem, stated as risks

1. The model invents a number. "Lunch yesterday" becomes €12.00 because 12 is a
   plausible lunch.
2. The model coerces. "Lunch 10 USD" becomes a €10.00 expense.
3. A draft becomes an expense without the person agreeing.
4. A retry after a dropped connection saves the same purchase twice.
5. Cost runs away: retries, parallel users, restarts that forget the count.
6. A key, a description or another user's categories leak somewhere.
7. The tests reach the real service, or pass without testing anything.

## Contracts that make the risks testable

**The model never produces final values.** It returns source spans —
`amount_text: "18"`, `currency_text: "євро"`, `date_text: "Учора"` — plus a
category *reference* (`c3`) from a list the server built for this request. The
server derives cents, the date and the category id itself, and checks that
every span is literally in the description. A span that is not (`"18"` when the
text says `"180"`) is a 502, not a draft.

**The server scans the description independently of the model.** If the text
contains `USD`, the result is unsupported whatever the model said. A guard can
only move a result towards safer (`ready → needs_input → unsupported`), never
back. This is what turns risk 2 into a test with a definite answer.

**A draft is not an expense.** `POST /api/ai/expense-draft` has no write path.
Every integration test counts the user's rows before and after, on every branch,
including failures.

**A save has an identity.** The review screen sends an `Idempotency-Key`. Same
key and payload replays the first 201; a different payload is 409; a deleted
expense is not resurrected. Unkeyed saves still behave as before — two coffees
are two coffees.

**Cost is bounded before the call.** Daily and per-minute quotas are reserved
atomically in SQLite before dispatch and stay spent when the call fails; one
request per user in flight; no retries.

## Tests, by the question each answers

| Question | Answer lives in |
|---|---|
| Does the normaliser refuse to invent or coerce? | 30 unit tests; 116-row corpus in fixture mode |
| Does the real adapter handle the real response shapes? | adapter tests against a local fake speaking the documented REST shape: refusal, incomplete, redirect, 64 KiB streaming cap, timeout |
| Does the whole HTTP flow hold on every branch? | 29 integration tests on a real server process and a fresh SQLite file |
| Can a retry duplicate? | 11 idempotency tests incl. 20 concurrent same-key saves and a restart |
| Can tests reach the internet? | a preloaded guard, and 4 tests that try to get past it |
| Does the UI keep its promises? | 25 Playwright tests × phone and desktop, incl. a lost save response retried with the same key |
| What about moments a browser test cannot reach? | 11 component tests that run the real `public/ai-expense.js`: a response that arrives after abort, a silent save, a switched account, a deleted category |
| Can a live evaluation overspend or touch the app? | 7 tests on the allowance, plus 20 on database identity and the holdout ledger, all running the real evaluator process with the network guard and a local fake provider |
| Does a report say which code it measured, and how much of the corpus? | 7 provenance tests on disposable copies of the source tree, 8 report tests including 216 rendered combinations |
| Are the numbers real? | mutations of the evaluator, the UI and the coverage gate, each run in a disposable copy; three stayed green, and each was explained rather than hidden |

## Findings — what testing actually turned up

- **BUG-014 (pre-existing, High):** on a 320×568 phone the category list was an
  18 px strip. Reproduced red first, fixed with a short-viewport layout, now
  guarded at two sizes.
- **BUG-019 (pre-existing, Medium):** oversized JSON returned 500 and logged the
  body. Now 413 `PAYLOAD_TOO_LARGE`, asserted in Newman and pytest.
- **The network guard failed open under fetch.** It threw synchronously inside
  Node's fetch internals; the exception escaped as uncaught and crashed the
  process instead of failing one request — and a test waiting on that fetch hung
  for 60 seconds rather than going red. The guard now destroys the socket with
  the error on the next tick, like a real network failure.
- **The entry button covered the amount.** No test saw it; the first
  screenshots did. Fixed, and a bounding-box test at four viewports was run red
  against the old CSS before being kept.
- **Windows paths in `NODE_OPTIONS` lost their backslashes**, so the guard was not
  loaded into child servers at all. Every child server failed to start, loudly —
  but only because the path was wrong, not because anything checked.
- **Two browser negative controls did not turn red at first.** One mutation hit
  the wrong code path; fixed and rerun, it went red. The other is a real gap: the
  request-generation check in the UI cannot be observed separately from
  `AbortController` in a browser test. It was recorded as open, not rewritten
  into a control that passes, and later closed by a component test that delivers
  a response despite the abort.
- **A partial independent review found four wrong-but-green behaviours** before
  it stopped at its usage limit. `Lunch 10USD` became a ready €10.00 draft (the
  currency code touched the digits); `Lunch -€10` became +€10.00; the evaluator
  passed with one wrong amount (59 of 60 is above a 98 % bar); a save to a server
  that never answered stayed on "Saving" forever. The fixture evaluation had
  reported 113/113 with the first two present. Each was reproduced by a new
  test, run red, then fixed; the evaluator now fails on a single wrong amount or
  date.
- **The project's own documentation gave unsafe advice.** It told the operator
  to raise the app's daily AI limits in `.env` for a live evaluation — the same file
  the app reads when it starts. The live evaluator now needs its own finite
  allowance and ignores the app's limits.
- **A billed failure lost its cost.** With a reasoning model, reasoning tokens
  count against the output-token bound, so an answer can end incomplete and
  still be paid for. The adapter discarded the usage of such answers; it now
  keeps it, and the evaluator reports known and unknown usage separately.
- **The completed independent review found four more, all in the evaluator's own
  safety.** The "never the app database" check compared path strings, and a
  Windows junction walked past it into a sentinel database. "Holdout runs once"
  looked at the word `holdout` in the arguments, so `--split all` sent the same
  rows with no record. The code identity came from Git, which does not see new
  files. And the Markdown report printed `undefined` for the renamed fields,
  while a one-row run read as PASS. The self-review had called the first two
  properties tested — they were, but only for the spelling the tests used. Each
  is now a failing-first test, and 19 deliberate breakages in throwaway copies
  prove the tests notice.

## What fixtures cannot prove

- **Model quality.** Every accuracy number published so far is from fixture mode:
  the labels' ideal answers played the model. `MODEL_QUALITY=NOT_MEASURED`.
- **Compatibility with a real OpenAI account.** Zero real calls were made.
- **Label quality.** All 116 rows were written by the same author as the
  normaliser and have not been reviewed independently.
- **Real phones.** Chromium viewports only; no on-screen keyboard.
- **Whether the output-token bound fits a reasoning model.** 600 tokens may end
  many answers incomplete; only a first real `--limit 1` run can show it.

## Where to challenge this

1. `src/ai/normalize.js` — vocabularies are finite lists. Find a currency or date
   form that slips past the scanner.
2. Whether a strict JSON schema plus a literal-span check is enough when the model
   picks the *wrong* genuine number from two.
3. `public/ai-expense.js` — the stale-response logic; the generation check is
   proven only at component level, not in a browser.
4. D-036 point 6 — C8 now trusts one helper's call shape in `qa/ai`.
5. The evaluator's denominators: is "amount accuracy over rows with an expected
   amount" the right question, or should needs-input rows count?
6. `qa/ai/evaluate.js` live mode — find a way for a live evaluation to spend more
   than `WALLET_AI_EVAL_DAILY_CALLS`, or to touch the app's database. The known
   gap: a process that swaps folders between the check and the open.

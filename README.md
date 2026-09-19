# Wallet Tracker

[![CI](https://github.com/DaniilBehus/wallet-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/DaniilBehus/wallet-tracker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A phone-first web app for tracking money going out — expenses, recurring
charges, and loans that count themselves down — built together with the test
layers that check it: UI, API, Python, end-to-end, race and load tests, plus an
offline-evaluated AI feature that turns a sentence into an expense draft.

| | |
|---|---|
| Self-check gate | 8 invariant and coverage gates, `npm run check` |
| API contract | 128 requests · 475 assertions · Postman + newman |
| API scenarios | 16 pytest scenarios · Python + httpx · JUnit XML |
| End-to-end | 64 scenarios × 2 viewports (phone and desktop) · Playwright |
| Concurrency | race checks with two real server processes on one SQLite file |
| Load | k6 · 50 concurrent writers, a burst of failed logins, and the logins the limiter allows |
| AI expense entry | 237 offline tests, 50 browser runs, a 116-row evaluation corpus — no real AI call needed |
| CI | GitHub Actions: secret scan, API, Python, Playwright and the offline AI suite |
| Defects | Reproduction, root cause, fix and regression check — [`log/BUGS.md`](log/BUGS.md) |

## The four screens

| Add | This month | Upcoming | Schedules |
|---|---|---|---|
| ![Add](docs/screenshots/1-add.png) | ![This month](docs/screenshots/2-month.png) | ![Upcoming](docs/screenshots/3-upcoming.png) | ![Schedules](docs/screenshots/4-schedules.png) |
| An amount, a category, save — two taps | Total, share per category, grouped by day | Next charge, and a loan counting down | One form; the checkbox is the only branch |

Interface in English, money as `€12.50`. The pictures are produced by
`npm run screenshots`, which creates its own demo account and captures all four
screens — so they can be redone in one command instead of going quietly stale.

## The idea that keeps it small

An expense, a subscription and a loan instalment are one thing at three moments
in time. An expense already happened. A subscription will happen and repeats
forever. A loan instalment will happen, repeats, and stops after N times.

So there is one table for money that moved, one for money that will move, and a
loan is just a schedule with a finite instalment count. No third concept.

## Stack

Node.js 22+ · Express · SQLite (`better-sqlite3`) · JWT · bcrypt
Frontend is plain HTML, CSS and vanilla JS — no framework, no build step.

Four runtime dependencies in total. `npm start`, no Docker, no external API.
The test tooling — newman, pytest/httpx, Playwright and k6 — is independent of
the application runtime and never imported by `src/`.

## Three design choices worth naming

**Money is an integer number of cents, everywhere.** €15.00 is `1500`.
Formatting to a display string happens only in the browser, at the last moment.
`0.1 + 0.2 !== 0.3`, and money in floats produces totals that cannot be
reconciled months later. `scripts/check.js` fails the build if float arithmetic
appears on the server.

**Derived values are computed on read, never stored.** The next charge date and
the remaining balance of a loan are calculated when asked for. A stored derived
value goes stale — and one of the defects found here was exactly that bug class
reappearing in the DOM instead of the database.

**Another user's row answers 404, not 403.** A 403 would confirm the row
exists, which turns id enumeration into a way to map somebody else's data. Six
cases in the API collection assert the 404 *and* assert it is not a 403.

## Describe an expense (optional AI feature)

<img src="docs/screenshots/ai-3-review-ready-demo.png" alt="Review of a suggested expense in demo mode" width="260"> <img src="docs/screenshots/ai-4-review-needs-input-demo.png" alt="A suggestion that still needs an amount, in demo mode" width="260">

*Both pictures are demo mode — sample responses, no AI service contacted.*

Type *"Учора витратив 18 євро на обід"* and Wallet fills in the Add form for you:
€18.00, Restaurants, yesterday, "обід". You check it and press Save; nothing is
stored before that. English, Ukrainian and Slovak; euro only; one expense at a
time. The keypad is unchanged and is still the fastest way in.

The model is treated as untrusted input. It may only point at text in your
description and pick a category from your own list; the server computes the
cents and the date itself, rejects anything that is not literally in the text,
and independently refuses what it can see is unsupported — `10 USD` never
becomes a euro expense, whatever the model says. Saves from the review screen
carry an `Idempotency-Key`, so a retry after a lost response cannot create a
second expense. Contract: [`spec/ai-expense-entry.md`](spec/ai-expense-entry.md).

**Real AI is off by default.** Every AI test, the evaluation and the demo run
offline: a network guard is preloaded, the provider is a local fake or a fixed
set of sample answers, and nothing needs a key.

```bash
npm run ai:demo        # http://localhost:3100 — fixed examples, no AI service, own database
```

| Mode | How | What happens |
|---|---|---|
| off | default | no entry point; nothing is sent anywhere |
| demo | `npm run ai:demo` | seven named example sentences; anything else says it is not in the demo |
| live | `WALLET_AI_MODE=live` + `OPENAI_API_KEY` + `WALLET_AI_MODEL` + `WALLET_AI_LIVE_ALLOWED=true` in a local `.env` | the description and your category names go to OpenAI after you tick a consent box; small daily and per-minute limits |

**What the evaluation does and does not show.** `npm run eval:ai` runs the
116-row corpus through the production service with fixture answers, so it
checks the normaliser, the guards and the scorer — not a model
(`MODEL_QUALITY=NOT_MEASURED`). A separate, explicitly enabled live evaluator
has its own finite allowance and a 5-calls-per-10-minutes window; no real-model
quality result is claimed here. Details:
[`qa/docs/ai-evaluation.md`](qa/docs/ai-evaluation.md).

## Testing

```bash
npm run check        # invariants: spec hash, no float money, testids, e2e discipline, coverage gates
npm run test:api     # 128 requests, 475 assertions
npm run test:python  # 16 isolated Python/httpx API scenarios; writes JUnit XML
npm run test:e2e     # 64 scenarios across a phone and a desktop viewport
npm run test:race    # two server processes, one database, concurrent writes
npm test             # check, Newman, pytest, Playwright and race checks
npm run test:load    # k6; needs k6 installed separately

npm run test:ai      # 237 offline tests (1 skipped where file symlinks need privilege)
npm run eval:ai      # fixture evaluation of the 116-row corpus (MODEL_QUALITY=NOT_MEASURED)
npm run test:ai:e2e  # 25 AI browser scenarios × phone and desktop, local fake provider
```

Nothing needs to be started first: each layer starts a server of its own, with
an isolated database. The pytest fixture additionally allocates a loopback port
and JWT secret per run. No suite contains a sleep.

To prepare the Python layer locally (Python 3.12+):

```bash
python -m venv .venv
.venv\Scripts\python -m pip install -r qa/python/requirements.txt  # Windows
npm run test:python
```

End-to-end and pytest scenarios that implement a catalogued case carry its id
(`TC-…`) from [`qa/docs/test-cases.md`](qa/docs/test-cases.md). An id that the
catalogue does not list fails before the test runs.

| | |
|---|---|
| [`qa/docs/test-design.md`](qa/docs/test-design.md) | How a change becomes a set of cases — nine steps, each with an example from this app |
| [`qa/docs/test-plan.md`](qa/docs/test-plan.md) | Scope, entry and exit criteria, risks |
| [`qa/docs/test-cases.md`](qa/docs/test-cases.md) | 163 cases with ids, priorities, results and a trace to a spec clause or a defect |
| [`qa/docs/defects/`](qa/docs/defects/) | Full defect reports from the test layers |
| [`qa/api/`](qa/api/) | Postman collection; the environment holds two variables and no literals |
| [`qa/python/`](qa/python/) | pytest + httpx scenarios; a real Express child, temporary SQLite, health check and JUnit XML |
| [`qa/e2e/`](qa/e2e/) | Playwright specs and page objects |
| [`qa/race/`](qa/race/) | Concurrency checks against two real server processes |
| [`qa/load/`](qa/load/) | k6 scripts; each measures the same endpoint idle and under load |
| [`qa/ai/`](qa/ai/) | AI layer: fake providers, network guard, evaluator, demo runner, corpus and fixtures |
| [`qa/docs/ai-test-plan.md`](qa/docs/ai-test-plan.md) | AI risks, layers and the TC-AI case register |
| [`qa/docs/ai-case-study.md`](qa/docs/ai-case-study.md) | What testing the AI entry actually found, and what fixtures cannot prove |

The end-to-end suite selects only by `getByTestId` and `getByRole`, waits only
through web-first assertions, and each spec creates its own user through the API
so nothing depends on execution order. Those are not conventions — `check.js`
fails the build if a `.locator()` or a `waitForTimeout` appears. Three more
gates ask whether what exists is covered: every route has a request, every
testid is addressed from a page object, every status the server can return is
provoked by some case. Exceptions live in one file with a written reason each;
an exception with an empty reason fails the build too.

## What the test layers actually found

- **BUG-004:** a burst of failed bcrypt logins blocked unrelated health requests.
  The load layer exposed it; rate limiting before bcrypt and asynchronous bcrypt
  removed the event-loop stall.
- **BUG-011 / BUG-012:** two real server processes sharing a fresh SQLite file
  could fail at boot or return 500 during a write race. The race layer exposed
  both; retrying boot pragmas and `BEGIN IMMEDIATE` fixed the mechanisms.
- **BUG-013:** on a phone viewport an edit panel sat underneath the bottom
  navigation. Playwright found the clickable-area failure; the panel now lives
  in the correct stacking context.
- **AI entry:** before any fix, `Lunch 10USD` became a ready €10.00 draft,
  `Lunch -€10` became +€10.00, and the evaluator passed a run with one wrong
  amount. Each was reproduced as a failing test first. See
  [`qa/docs/ai-case-study.md`](qa/docs/ai-case-study.md).

Every defect in [`log/BUGS.md`](log/BUGS.md) closes with either a reusable rule
or an explicit `No rule — one-off.`

## Honest limits

- The AI entry has never produced a result from a real model; the corpus labels
  were written by the same author as the normaliser and have not been reviewed
  independently; its browser tests use emulated phone viewports.
- This is a single-user, local-SQLite application. It has no Docker or
  deployment configuration, cross-browser matrix, penetration test,
  dependency-CVE scan or offline sync.
- On restricted local hosts Playwright may need permission to launch Chromium;
  GitHub Actions is the reference browser environment.

## How this repository is organised

| | |
|---|---|
| `src/`, `public/` | The application: Express API, SQLite schema, and the plain-JS frontend |
| `qa/` | All test layers and their documentation |
| [`spec/handoff.md`](spec/handoff.md) | The specification. Hashed — `check.js` fails if a byte moves without the hash being re-recorded |
| [`spec/ai-expense-entry.md`](spec/ai-expense-entry.md) | The contract for the optional AI feature |
| [`log/BUGS.md`](log/BUGS.md) | Defect register — reproduction, root cause, fix, regression check |
| `scripts/` | The self-check gate and the screenshot generator |
| `docs/screenshots/` | The pictures above, all from demo accounts |

## Running it

```bash
npm install
cp .env.example .env    # set JWT_SECRET
npm start               # http://localhost:3000
```

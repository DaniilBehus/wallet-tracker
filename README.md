<div align="center">

# Wallet Tracker

**Expenses, recurring charges and loans. A working app with a documented QA workflow.**

[![CI](https://github.com/DaniilBehus/wallet-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/DaniilBehus/wallet-tracker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-087f6d.svg)](LICENSE)

[Screenshots](#screenshots) · [QA evidence](#qa-evidence) · [Quick start](#quick-start) · [AI feature](#ai-expense-entry) · [Architecture](#architecture)

</div>

A personal finance web app designed for a phone: record an expense, review the month,
and keep track of subscriptions and loan instalments. This repository includes the
application, test design, automated checks and documented defects.

## Screenshots

<p align="center">
  <a href="docs/screenshots/1-add.png"><img src="docs/screenshots/1-add.png" width="270" alt="Add an expense: amount keypad, categories and save action"></a>
  &nbsp;
  <a href="docs/screenshots/2-month.png"><img src="docs/screenshots/2-month.png" width="270" alt="Monthly overview: spending total, category breakdown and transaction history"></a>
</p>

<p align="center"><strong>Add an expense</strong> · <strong>Review the month</strong><br>English interface · EUR amounts · Demo account data</p>

<details>
<summary><strong>More screens: upcoming payments and schedules</strong></summary>

<p align="center">
  <a href="docs/screenshots/3-upcoming.png"><img src="docs/screenshots/3-upcoming.png" width="270" alt="Upcoming subscription payments and remaining loan instalments"></a>
  &nbsp;
  <a href="docs/screenshots/4-schedules.png"><img src="docs/screenshots/4-schedules.png" width="270" alt="Schedule form for recurring payments and finite loans"></a>
</p>

Subscriptions repeat; loans stop after a set number of instalments. Both use the same
schedule model. Recreate these four screenshots with `npm run screenshots`.

</details>

## QA evidence

**Start with [test design](qa/docs/test-design.md), browse the [test cases](qa/docs/test-cases.md),
then follow a [defect from reproduction to regression](qa/docs/defects/).**

| Area | Scope | Evidence |
|---|---|---|
| Test planning | Risks, scope, entry and exit criteria | [Test plan](qa/docs/test-plan.md) |
| Test design | 163 catalogued cases with priorities and traceability | [Case catalogue](qa/docs/test-cases.md) |
| API | 128 requests · 475 assertions; 16 Python scenarios | [Postman](qa/api/) · [pytest](qa/python/) |
| Browser | 64 scenarios, each at phone and desktop sizes | [Playwright specs & page objects](qa/e2e/) |
| Concurrency & load | Two server processes on one database; k6 write and login workloads | [Race checks](qa/race/) · [k6](qa/load/) |
| AI feature | Offline tests, browser checks and fixture evaluation | [AI case study](qa/docs/ai-case-study.md) |

GitHub Actions runs the secret scan, API, Python, Playwright and offline AI checks.
The self-check command enforces eight invariant and coverage gates.
[Run the suites and inspect their setup →](docs/testing.md)

### Defects worth opening

| Finding | What exposed it | Read the investigation |
|---|---|---|
| Failed logins blocked unrelated requests | Load testing caught synchronous bcrypt blocking the event loop | [BUG-004](qa/docs/defects/BUG-004-bcrypt-blocks-event-loop.md) |
| Concurrent writes returned 500 | Two server processes revealed a SQLite transaction race | [BUG-012](qa/docs/defects/BUG-012-deferred-transaction-500.md) |
| An unsupported currency became a EUR draft | Negative AI cases exposed missing validation | [AI case study](qa/docs/ai-case-study.md) |

[Full defect register: reproduction → root cause → fix → regression check](log/BUGS.md)

## Quick start

**Requires Node.js 22+.** Clone the repository, then install the locked dependencies:

```bash
git clone https://github.com/DaniilBehus/wallet-tracker.git
cd wallet-tracker
npm ci
```

Copy `.env.example` to `.env` (`cp .env.example .env` on macOS/Linux,
`Copy-Item .env.example .env` in PowerShell). Set `JWT_SECRET` to a long random value.
You can generate one locally with:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
npm start
```

Open **http://localhost:3000**. The standard app runs locally with SQLite; no AI key is required.

For API, Python, browser and load test prerequisites, see [Running the tests](docs/testing.md).

## AI expense entry

Describe one expense in English, Ukrainian or Slovak, review the suggested fields,
then save. The server validates the amount, date and category; retrying a save uses
an idempotency key. The normal keypad remains available.

```bash
npm run ai:demo
```

The demo opens at **http://localhost:3100**, uses its own database and accepts seven
fixed example sentences. **It uses sample responses and never calls an AI service.**

The AI layer has 237 offline tests, 25 browser scenarios across two viewports,
and a 116-row fixture corpus. These check the application and evaluator;
**real-model quality has not been measured** (`MODEL_QUALITY=NOT_MEASURED`).
One offline test is skipped on hosts where file symlinks require extra privileges.

[Screenshots & modes](docs/ai-feature.md) · [Feature contract](spec/ai-expense-entry.md) · [Evaluation method & limits](qa/docs/ai-evaluation.md)

## Architecture

**Node.js 22+ · Express · SQLite · JWT · bcrypt**  
Plain HTML, CSS and JavaScript in the browser. Four runtime dependencies, no frontend build step.

| Decision | Why it matters |
|---|---|
| Store money as integer cents | Avoid floating-point errors in totals |
| Calculate derived values on read | Keep the next charge and remaining loan balance consistent |
| Return 404 for another user's row | Avoid confirming that someone else's record exists |

| Location | Contents |
|---|---|
| [`src/`](src/) · [`public/`](public/) | Express API, SQLite schema and browser interface |
| [`qa/`](qa/) | Test suites, test design, cases and reports |
| [`spec/architecture.md`](spec/architecture.md) | Detailed architecture and development notes |
| [`log/BUGS.md`](log/BUGS.md) | Defect register and regression evidence |
| [`scripts/`](scripts/) | Self-check gates and screenshot generator |

## Known limits

- The AI entry has not produced a result from a real model. The corpus labels were
  written by the normaliser's author and have not been independently reviewed.
- Phone coverage uses emulated viewports. There is no cross-browser test matrix.
- The app uses local SQLite. No deployment configuration, Docker setup, penetration
  test, dependency-CVE scan or offline sync is included.
- On restricted hosts, Playwright may need permission to launch Chromium.
  GitHub Actions is the reference browser environment.

---

Personal project by [Daniil Behus](https://github.com/DaniilBehus) · [MIT license](LICENSE)

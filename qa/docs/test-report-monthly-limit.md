# Monthly spending limit — test report

[← Back to README](../../README.md#qa-evidence) · [Next: UAT script →](uat-monthly-limit.md)

**Date:** 2026-09-23

**Build under test.** The application code of commit `4ad444d`
*(feat(month): monthly spending limit with within/reached/exceeded state)*. The
follow-up commit that carries this report adds `qa/db/migration.test.js`, its
npm script and CI step, and corrections to these documents; it changes nothing
in `src/` or `public/`, and `git diff 4ad444d -- src public` is empty.

**CI has not run any of this.** `origin/main` is `9924aba`; neither `4ad444d`
nor the follow-up commit has been pushed. **Every result in this report is a
local run on one Windows machine**, and none of it has been reproduced on the
project's CI runners. Where that distinction matters it is repeated below rather
than assumed.

**Verdict:** the feature meets the requirements in
[`analysis-monthly-limit.md`](analysis-monthly-limit.md) as far as the local
suite can show. One defect was found during testing and fixed. The acceptance
pass has been rehearsed but **not accepted by a person** — see §6.

## 1. Scope of this pass

Requirements REQ-ML-01…10, the eight rules of the decision table, the boundary
list, the negative cases, and the one risk about databases that already exist
(RISK-ML-5). Twenty-three cases: TC-API-091…105, TC-E2E-065…069 and
TC-DB-001…003, all automated.

Environment: Windows, Node v24.13.1 (CI pins 22), SQLite through
`better-sqlite3`, Playwright 1.62.1 on Chromium at two viewports, Newman against
a server the runner starts with its own throwaway database. No `.env`, no AI
provider, no external service was used.

## 2. Tests before the code — and how much of that a reader can check

The API and browser cases were written from the analysis document and run before
any implementation existed. What that run showed, from the terminal at the time:
`npm run test:api` failed **92 assertions** across the new folder 12 and the
existing settings and summary contract cases, because the response schemas
required `monthly_limit_cents`, `limit_cents`, `limit_status` and
`limit_remaining_cents` and none of them existed; the five browser cases failed
**10 times** (5 × 2 viewports) because every limit test id was missing from the
screen.

**Those two numbers are a local observation, not evidence anyone else can
reproduce.** The tests and the implementation landed in one commit, so the
pre-implementation state is not in the history, nothing was pushed, and no CI
run ever saw it. They are recorded because they happened, and they are marked
here because a reader cannot verify them.

The one piece of red-first evidence that **is** reproducible on demand is the
migration test. Comment out the guard in `src/db.js` that adds the column —
change `if (!columns.includes('monthly_limit_cents'))` to `if (false)` — and run
`npm run test:db`: all three cases fail, TC-DB-001 on "the column was not
added". Restore the guard and all three pass. That was run in both directions on
2026-09-23 (3 fail / 3 pass), and anyone can run it again in under a minute.

## 3. Defects found while testing

| # | What | How it was found | Status |
|---|---|---|---|
| 1 | On a phone-width viewport the limit state line sat **inside the flex row** holding the donut and the figures, so it became a third column: the donut covered the limit control and the control could not be tapped | TC-E2E-068 and TC-E2E-069 failed on `mobile-chromium` only, while all five cases passed on the desktop viewport | Fixed — the line moved out of `.overview`; both viewports green. The comment in `public/index.html` records why it may not move back. The UAT pass re-checked it at 375 px: the control's hit test returns the control, not the donut |

Nothing else failed for a product reason. Two API cases were rewritten during
the pass for a *test* reason, recorded here because it changes what the suite
proves: the boundary rules first ran against the first account, whose month
already contains ceiling-sized amounts from other folders, so "one cent below
the month total" was a limit above the 1 000 000 EUR ceiling and was correctly
refused with 400. The decision-table rules now run on the second account, whose
month this folder fills with exact amounts (2500, then 1000).

## 4. Results — the local run of 2026-09-23

| Gate / layer | Command | Result |
|---|---|---|
| Self-check | `npm run check` | **OK — 8 pass, 0 skip, 0 fail** |
| Database migration | `npm run test:db` | **3 pass, 0 fail** |
| API contract | `npm run test:api` | **171 requests, 621 assertions, 0 failed** |
| Python API scenarios | `npm run test:python` | **16 passed** |
| End-to-end | `npm run test:e2e` | **138 passed** (69 cases × 2 viewports) |
| Concurrency | `npm run test:race` | **0 invariant violations** |
| Whole suite | `npm test` | **exit 0** |
| AI expense entry (untouched by this change) | `npm run test:ai` | **237 tests: 236 passed, 1 skipped, 0 failed** |
| Fixture evaluation (untouched) | `npm run eval:ai` | **MODE=FIXTURE RESULT=PASS, 113/113 supported rows** |

Every line of that table is this machine. The CI workflow runs `check`,
`test:db`, `test:api`, `test:python`, `test:e2e` and the AI jobs, so it will
cover all of it except `test:race` — but it has not done so for this work yet,
and until it does, the column above says what one machine found and nothing
more.

Traceability, requirement by requirement, is the table in §5 of the analysis
document; every row's result is PASS from this run.

Decision-table coverage, rule by rule: R1 TC-API-095 · R2 TC-API-095 · R3
TC-API-096 · R4 TC-API-096 · R5 TC-API-097 · R6 TC-API-098 · R7 TC-API-099 ·
R8 TC-API-099.

Boundaries. The cases hold the month total still and move the limit past it,
which reaches the same three points as the "total = `L − 1` / `L` / `L + 1`" row
of the boundary list:

| Point | How the case arranges it | Case | Expected |
|---|---|---|---|
| total one cent **under** the limit | `L = 1` on an empty month (`T = 0`) | TC-API-100 | `within`, one cent left |
| total **equal** to the limit | `T = 2500`, `L = 2500` | TC-API-097 | `reached`, nothing left |
| total one cent **over** the limit | `T = 2500`, `L = 2499` | TC-API-098 | `exceeded`, `−1` left |

Also: `L = 0` with `T = 0` and with `T > 0` as TC-API-099, the ceiling and
ceiling + 1 as TC-API-103 and TC-API-102.

## 5. The one thing no other layer covers

Every other layer starts from an empty database file, where `CREATE TABLE`
already carries `monthly_limit_cents` and the guarded `ALTER TABLE` in
`src/db.js` never runs. A person upgrading an existing Wallet takes the opposite
path, and until this pass nothing tested it. `qa/db/migration.test.js` builds a
database in the pre-limit shape with an account and a stored income, boots the
database layer against it in a child process, and checks that the column
arrives nullable, that the income survives, that the limit reads `null` rather
than `0`, that booting again neither fails nor adds the column twice, and that
an upgraded database ends up with the same `settings` table as a fresh one.

## 6. Known limitations

- **The UAT has been rehearsed, not accepted.** Claude drove all eleven steps of
  [`uat-monthly-limit.md`](uat-monthly-limit.md) on 2026-09-23 against a
  throwaway database and recorded what it saw; every step behaved as the script
  expects. The owner's sign-off is empty, no screenshot was captured — the
  browser pane never painted — and nothing was judged by eye, including the
  over-limit colour. A person's pass is still outstanding.
- **One limit, not one per month** (assumption A2). Changing the limit
  re-judges every month on the screen, including past ones. No history is kept.
- **The limit does not block anything** (A1). It is a signal; an expense above
  it is still saved. There is no warning dialog and no notification.
- **Browser coverage is emulated.** Two Chromium viewports, no physical device
  and no other browser engine.
- **No load or concurrency case of its own.** The limit is a read-side
  computation over the existing month query; the k6 and race layers were not
  extended for it.
- **No Python scenario.** The API side is covered by the Newman folder; the
  pytest layer keeps its existing six scenarios.
- **The migration test covers one upgrade, on SQLite, on one platform.** It does
  not test a database that was corrupted, locked by another process, or made by
  a version older than the one in `9924aba`.
- **Month boundaries and time zones** are inherited from the existing month
  query, which is tested elsewhere; this pass added no new cases for them.
- **Accessibility** was checked as "text, not colour alone" (REQ-ML-09) and by
  the existing contrast helper on the month screen; no screen-reader pass was
  made.

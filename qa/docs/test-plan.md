# Test plan · WALLET

[← Back to README](../../README.md#qa-evidence) · [Next: test design →](test-design.md)

**Version 1.1 · originally written 2026-09-07; later extended for the monthly
spending limit.** The current public architecture notes are in
[`spec/architecture.md`](../../spec/architecture.md). Dated run results are
recorded separately in the reports and CI.

The [architecture notes](../../spec/architecture.md) and feature analyses,
including the [monthly limit analysis](analysis-monthly-limit.md), define the
documented requirements. Test conditions trace back to those sources or to a
recorded defect.

---

## 1. What is being tested

A phone-first web application for tracking money leaving an account: one-off
expenses, recurring charges, and loans that count themselves down. Node.js and
Express over SQLite, with a plain HTML/CSS/JS frontend and no build step.

The property the whole application rests on: **money is an integer number of
cents everywhere, and becomes a display string only in the browser.** A rounding
error here is not a cosmetic defect — it is a total that cannot be reconciled.

---

## 2. Scope

### In scope

| Area | Covered by |
|---|---|
| All explicit API operations, including category-limit PATCH and AI — status codes, response bodies, error contract | `qa/api/`, `qa/ai/`, [OpenAPI/contract layer](../../docs/api/README.md) |
| Parameterized invalid-data classes and multi-step API state | `qa/python/` (D-032) |
| Selected documented status/media/header schema and empty204; observed versus unexercised paths explicit | `qa/contract/` strict non-mutating Ajv; [matrix](test-report-contract.md#observed-status-matrix) |
| Authentication: registration, sign-in, the five token states | `qa/api/`, `qa/e2e/auth.spec.js` |
| Cross-user isolation (spec §4.3) | `qa/api/`, `qa/e2e/month.spec.js` |
| Validation boundaries (spec §4.3) | `qa/api/`, `qa/e2e/schedules.spec.js` |
| `nextDue` clamping, including February and leap years (spec §4.1) | `qa/api/`, `qa/e2e/schedules.spec.js` |
| The loan countdown and its 409 on a closed loan (spec §4.2) | `qa/api/`, `qa/e2e/upcoming.spec.js`, `qa/e2e/regressions.spec.js` |
| The four screens and the bottom navigation (spec §6) | `qa/e2e/` |
| Money formatting at the edge (`€12.50`) | `qa/e2e/` |
| Accessible names on interactive elements (D-012) | `qa/e2e/` |
| Monthly income, and what remains of it (D-021) | `qa/api/`, `qa/e2e/income.spec.js` |
| Category limits: independent budgets, ownership, migration, server judgement and editor | [REQ-CL-01…13](analysis-category-limits.md), API / DB / Playwright / Selenium |
| The donut: one arc per category, none when nothing is spent (D-022) | `qa/e2e/income.spec.js` |
| Behaviour under concurrent load, and head-of-line blocking | `qa/load/` |
| Secrets never reaching the repository | `gitleaks`, in CI |

### Out of scope, and why

| Not tested | Why |
|---|---|
| What remains in spec §9 | Not built: per-month budget history, warnings/blocking, multiple currencies, CSV/PDF export, offline sync, theme switching, password reset, Docker, notifications. Overall and category limits are in scope; category evidence is local until publication. The interface uses a fixed dark palette with no light/dark toggle |
| ~~Load and performance~~ | **Now in scope** (S07). This line used to read "a single-user personal application over a local SQLite file, there is no concurrency model to stress". That reasoning was wrong in an instructive way: the concurrency model worth stressing was never SQLite's, it was Node's single thread. `qa/load/` found BUG-004 on the first run |
| Security beyond authorisation and secret scanning | No penetration testing, no dependency CVE scanning. Named here so its absence is a decision, not an oversight |
| Cross-browser | Chromium only, in two viewports. The application uses no API that varies between engines, and one browser that is actually run beats four that are aspirational |
| Visual regression | No baseline screenshots. Layout is asserted through geometry and accessible names instead |
| `better-sqlite3`, Express, bcrypt, jsonwebtoken | Third-party code with its own suites |

---

## 3. Approach

**How the cases are derived is itself written down**, in
[`test-design.md`](test-design.md): nine steps that take a change and produce a
list of cases, so that two people would arrive at roughly the same set and a
gap is something somebody decided rather than something nobody thought of.
Three gates in `scripts/check.js` watch its output — C6 routes, C7 testids,
C8 statuses.

The core layers, each answering a different question:

| Layer | Question | Tool |
|---|---|---|
| Self-check gate | Are the project's own invariants intact? | `scripts/check.js` |
| API | Does the contract hold? | Postman collection via newman |
| OpenAPI and real-response contract | Does code/description drift, and does each operation's actual success/error response fit its selected schema without cleanup? | Swagger Parser + source inventory + Ajv, `qa/contract/` |
| Python API scenarios | Do invalid input classes, auth boundaries and a long stateful flow hold through an independent client? | pytest + httpx |
| End-to-end | Can a person actually do the thing? | Playwright |
| Selenium browser checks | Do eight key flows also hold through WebDriver, the other common way to drive a browser? | Selenium + pytest |

The core date algorithm is exercised from outside through the API table. The
contract layer also tests its own scanner/validator controls: those prove the
gates reject drift and corrupt captures, not that a production defect exists.
The AI layer has its own separately registered unit/integration/evaluation tests.

Test data is created by the tests, never seeded by hand: every API run makes its
own two users from a run id, the pytest fixture starts the real Express process
with a temporary SQLite file, port and JWT secret, and every end-to-end spec
registers its own account through the API, as does every Selenium test.
Nothing shares state, so nothing depends on execution order and everything can
run in parallel.

---

## 4. Entry criteria

Testing starts only when all of these hold:

1. `npm run check` prints `OK` — the spec hash matches, no float money
   arithmetic on the server, every `data-testid` from §6.5 present.
2. The application starts with `npm start` and `/api/health` answers 200.
3. The build under test is a committed state of `main`, and CI is green on it.
4. Any defect from the previous cycle marked `CLOSED` has a regression check
   named in its report.

For a local pre-publication contract review, identify the base and dirty-file
hashes and record the actual local commands instead of claiming a new green CI
commit. The [contract report](test-report-contract.md) explicitly separates
that stage from published CI and owner acceptance.

---

## 5. Exit criteria

A cycle is finished when **all** of these hold:

1. Every Newman assertion passes — currently 939 across 271 requests.
2. Every Python scenario passes and writes `qa/reports/python-junit.xml` — currently 27 pytest items.
3. Every end-to-end test passes in both viewports — currently 93 scenarios × 2 viewports.
4. Every Selenium check passes and writes `qa/reports/selenium-junit.xml` — currently 11 pytest items.
4. All three load scenarios stay inside their thresholds.
3. `gitleaks` reports no findings.
4. No defect of severity **Critical** or **High** is open. BUG-005 is open at
   **Low** and uncharacterised; it is named here so that its openness is a
   decision rather than an oversight.
5. Every defect found in the cycle has a full report in `log/BUGS.md`, closed
   with either a rule (`R#`) or the explicit line `No rule — one-off.`
6. Every test that failed during the cycle and now passes did so **because the
   application changed**, not because the assertion was relaxed.

Point 6 is the one that is easy to skip and the one worth the most. A suite
edited until it agrees with the code has stopped being a test suite.

Contract-layer exit additionally requires `check:openapi` and `test:contract`
PASS, observed2xx for every source-derived operation, a truthful status matrix,
and passing capture/inventory negative controls with unchanged originals.
The [280-case register](test-cases.md#totals) counts11named contract tests,
not their244HTTPrequests. k6 results remain historical unless actually rerun.

---

## 6. Risks

| Risk | Why it matters here | What is done about it |
|---|---|---|
| **A date assertion that depends on "today"** | It passes today and fails next month, and it looks like a defect in the code | Rule **R1**. Any test expecting a specific date pins the input to a date in the future. Both the API collection and the end-to-end specs compute "next February" rather than hard-coding one |
| **Money asserted as a formatted string** | Asserting a literal makes every test depend on the exact characters, invisible ones included | A helper builds the expected value from cents and matches whitespace loosely, in two forms — anchored and not (R4) |
| **Testids appearing twice** | A selector that matches two elements is not a selector | The application clears a screen's rows when it is left; the API contract is asserted per id |
| **Tests that only pass in a particular order** | The first person to run one file alone gets a failure that is not real | Every spec creates its own user. `fullyParallel: true` is on, so an order dependency fails immediately rather than lurking |
| **A suite that finds nothing** | Green tests are evidence only if they can go red | Both gates have been provoked deliberately: `check.js` on deliberately broken inputs, the API schema assertions on a wrong schema and a wrong status code |
| **CI passing on a stale artifact** | A cached build hides the failure it was supposed to catch | Each CI job checks out fresh and runs `npm ci` |
| **A month with more than 200 expenses** | The month screen requested 200 rows, so the list truncated silently while the total stayed whole | **CLOSED S16 (D-031).** The list is paged 50 at a time and shows `Showing 50 of 213`. Covered at 50, 51 and 201 in `qa/e2e/pagination.spec.js` — 201 being the row that never used to load |
| **Two server processes on one database file** | Nothing had ever created this condition, so no layer could observe it | **CLOSED S16.** `qa/race/` runs two servers on one file every time. It found BUG-011 and BUG-012 on its first run |
| **Two actors changing one row at the same moment** | The specification says who may change a row, never who wins when two do | **PARTLY CLOSED S16 (D-030).** Invariants are asserted rather than expected values; see `test-design.md` §8a. The remaining half is a written rule about ordering, which the spec still does not have |
| **Secret committed by accident** | Irreversible once pushed to a public repository | `gitleaks` runs first in CI over the full history and fails the pipeline |

---

## 7. Environments

| | |
|---|---|
| Application | Node.js 22+ (developed on v24.13.1), SQLite file. Ports: 3000 development, 3001 API run, 3002 end-to-end, 3100 load, 3005 screenshots (D-017) |
| API layer | newman, run through `qa/api/run.js`, which waits for `/api/health` and mints the expired token |
| Python API layer | Python 3.12+, pytest + httpx; `qa/python/conftest.py` starts and health-checks a real Node child on a dynamic loopback port, with temporary SQLite and a new secret |
| End-to-end | Playwright, Chromium, two viewports: Pixel 5 (the primary — the app is phone-first) and desktop |
| CI | GitHub Actions, `ubuntu-latest`: secret scan → API (self-check, OpenAPI, contract, migration, Newman) → Python → Playwright/Selenium; offline AI depends on API. New contract steps are local until published/run |
| Database | A throwaway file per CI job. Never a database with real data in it |

---

## 8. Deliverables

| | |
|---|---|
| `qa/api/wallet.postman_collection.json` | The API collection |
| `qa/api/wallet.postman_environment.json` | Two variables: `baseUrl`, `token` |
| `qa/python/` | pytest/httpx scenarios and isolated-server fixture |
| `spec/openapi.json`, `docs/api/README.md`, `qa/contract/` | Machine-readable contract, navigation/examples and executable real-response checks |
| `qa/docs/test-report-contract.md` | Observed/unexercised status matrix, validator controls and local regression evidence |
| `qa/e2e/` | Playwright specs and page objects |
| `qa/selenium/` | Selenium + pytest checks, Page Objects and the failure-evidence hook |
| `qa/docs/test-design.md` | How a change becomes a set of cases |
| `qa/docs/test-cases.md` | The case register with ids and results |
| `qa/docs/defects/` | Defect reports found by this layer |
| `qa/reports/api-report.html` | Newman HTML report (CI artifact) |
| `qa/reports/python-junit.xml` | pytest JUnit report (CI artifact) |
| `playwright-report/` | Playwright HTML report and traces (CI artifact) |
| `qa/reports/selenium/` | Screenshot, page source and console of each failed Selenium test (CI artifact on failure) |
| `log/BUGS.md` | The project-wide defect register — the single source of truth |

---

## 9. How to run it

```bash
npm install

npm run check      # invariants
npm run check:openapi # source/schema inventory gate
npm run test:contract # 11 named tests, 244 real HTTP checks
npm run test:db     # 6 migration cases
npm run test:api   # 271 requests, 939 assertions
npm run test:python # 27 pytest items; Python 3.12+ and qa/python/requirements.txt
npm run test:e2e   # 93 tests × 2 viewports
npm run test:selenium # 11 pytest items in headless Chrome; the same requirements
npm run test:load  # k6; needs k6 installed separately
```

Nothing needs to be started first: each layer starts a server of its own, on
its own port, with a throwaway database. `npm test` runs check, migration,
Newman, pytest, Playwright and race in order. Contract, AI, fixture evaluation
and Selenium use the separate commands in [test setup](../../docs/testing.md).
The load smoke is separate because its numbers depend on the machine.

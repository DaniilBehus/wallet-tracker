# Test plan · WALLET

[← Back to README](../../README.md#qa-evidence) · [Next: test design →](test-design.md)

**Version 1.1 · originally written 2026-09-07; later extended for the monthly
spending limit.** [Current QA/release status](../../docs/qa-status.md) separates
this plan from dated results. The current public architecture notes are in
[`spec/architecture.md`](../../spec/architecture.md). Dated run results are
recorded separately in the reports and CI. The published application snapshot
`7b1cb328` has a [6/6 post-merge CI run](https://github.com/DaniilBehus/wallet-tracker/actions/runs/39248991256); this does not sign owner UAT.

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
| Cross-user isolation ([REQ-CORE-04](../../spec/core-requirements.md#req-core-04)) | `qa/api/`, `qa/e2e/month.spec.js` |
| Validation boundaries ([REQ-CORE-06/07/11/16](../../spec/core-requirements.md)) | `qa/api/`, `qa/e2e/schedules.spec.js` |
| `nextDue` clamping, including February and leap years ([REQ-CORE-12](../../spec/core-requirements.md#req-core-12)) | `qa/api/`, `qa/e2e/schedules.spec.js` |
| The loan countdown and its 409 on a closed loan ([REQ-CORE-13](../../spec/core-requirements.md#req-core-13)) | `qa/api/`, `qa/e2e/upcoming.spec.js`, `qa/e2e/regressions.spec.js` |
| The four screens and the bottom navigation ([architecture §5](../../spec/architecture.md#5-interface-and-interaction-design)) | `qa/e2e/` |
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
| [Architecture §7](../../spec/architecture.md#7-deliberate-limits) exclusions | Not built: per-month budget history, warnings/blocking, multiple currencies, CSV/PDF export, offline sync, theme switching, password reset, Docker, notifications. Overall and category limits are in scope; their [dated publication evidence](../../docs/analysis/README.md#dated-publication-evidence--2026-09-29) does not sign [owner UAT](uat-category-limits.md). The interface uses a fixed dark palette with no light/dark toggle |
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
Three static-inventory gates in `scripts/check.js` compare route/request
declarations (C6), literal testids/page-object addresses (C7), and global
status/assertion declarations (C8). C9 validates exception identity/reasons.
These are not execution coverage; the [observed operation/status
matrix](test-report-contract.md#observed-status-matrix) marks unexercised cells.

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
own users from a run id, the pytest fixture starts the real Express process
with a temporary SQLite file, port and JWT secret, and browser specs/tests
register separate accounts through the API. The [managed Playwright runner](../../docs/testing.md)
uses one disposable server/database and IP-based login limiter for its whole
invocation, so separate accounts do **not** mean fully independent processes or
rate-limit state. The tests should not depend on row order; parallel execution
still needs isolation and runner controls.

---

## 4. Entry criteria — three different decisions

1. **Developer/local regression may begin on a dirty tree.** Identify the
   committed base, changed paths and source hashes; name the exact commands,
   environment, oracle and prior defect evidence. Run the relevant static
   checks and disposable-server health check when that layer requires them.
   A green `main` or remote CI run is not a prerequisite for writing the tests
   that make a candidate build green. Static checks, including the separate
   [traceability checker](../../scripts/traceability.js), validate declarations
   and links, not execution or semantic correctness.
2. **Release acceptance** starts only after the candidate is identified by an
   exact commit SHA and the combined tree has completed its relevant full
   [verification plan](../../scripts/verification-plan.js), including an exact-SHA
   CI run. Review unresolved defects and risks; a local bounded PASS is not
   release approval.
3. **Owner UAT** has its own scripted acceptance and owner sign-off, for example
   [category limits](uat-category-limits.md) and [monthly limits](uat-monthly-limit.md).
   Neither automation nor publication signs on the owner's behalf.

Previously closed defects retain their regression references in
[the defect register](../../log/BUGS.md). Dated reports such as the
[contract report](test-report-contract.md) distinguish local proof from remote
CI and UAT.

---

## 5. Exit criteria — do not merge the gates

1. **Developer/local regression complete:** the scoped tests and relevant
   controls pass on the identified source tree; failed-before/fixed-after
   evidence names an independent expected behavior. A product fix, a fixture
   fix or a test/harness/oracle repair can be legitimate when the oracle is
   independently justified and assertions are not weakened to disguise a
   defect. Record failed, skipped and not-run checks explicitly. A bounded
   local repair may finish while release remains **NOT READY**.
2. **Release acceptance:** run the relevant full combined-tree verification
   and inspect its reports, including Newman, Python, both browser layers,
   contract/OpenAPI, static controls and secret scan as configured in the
   [shared plan](../../scripts/verification-plan.js). Require an exact-SHA
   green CI result, a truthful observed/unexercised status matrix, and a
   reviewed defect/risk disposition. k6 is separate and historical until
   actually rerun; do not describe its old thresholds as a new release result.
   An unresolved Critical/High defect in `OPEN` **or** `IN PROGRESS` blocks
   release unless the **owner explicitly** grants and records a scoped
   exception; local or uncommitted repair is not automatic release clearance.
   [BUG-021](../../log/BUGS.md#current-dispositions--2026-10-19) is now
   CLOSED: the published schedule-edit regression and the owner's named
   2026-10-19 UAT PASS meet its specific criteria. This is not a blanket
   risk waiver. [BUG-005](../../log/BUGS.md) remains Low/OPEN with an unknown
   cause; do not relabel it as flaky or fixed.
3. **Owner UAT complete:** the owner executes and signs the relevant scripts.
   The owner reported [13/13 category-limit steps plus schedule edit, focus and
   Month refresh PASS](uat-current-build.md#owner-record--reported-2026-10-19)
   and accepted that synthetic-data test build. Optional uncertain Save/Pay
   response remains **NOT RUN**. This scoped decision is not a live-provider,
   load or general release certificate; automation alone cannot supply it.

Keep each defect's reproduction, repair and regression evidence in
[the register](../../log/BUGS.md), including a rule or an explicit one-off
reason when closed. The [case register](test-cases.md#totals) is a dated
historical snapshot, while the [current QA status](../../docs/qa-status.md)
names what is still unresolved; neither is a live execution count.

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
| Application | Supported Node.js range: [test setup](../../docs/testing.md) / [package engines](../../package.json); SQLite file. Ports: 3000 development, 3001 API run, 3002 end-to-end, 3100 load, 3005 screenshots (historical environment note D-017, not a product rule) |
| API layer | newman, run through `qa/api/run.js`, which waits for `/api/health` and mints the expired token |
| Python API layer | Python 3.12+, pytest + httpx; `qa/python/conftest.py` starts and health-checks a real Node child on a dynamic loopback port, with temporary SQLite and a new secret |
| End-to-end | Playwright, Chromium, two viewports: Pixel 5 (the primary — the app is phone-first) and desktop |
| CI | GitHub Actions, `ubuntu-latest`: one shared [verification inventory](../../scripts/verification-plan.js) for secret scan → API (including race) → Python → Playwright/Selenium; offline AI depends on API. The [current status](../../docs/qa-status.md) links the exact published-build result and its remaining non-CI gates |
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
| `qa/reports/api-report.html` | Local Newman HTML; the [published-build CI run](https://github.com/DaniilBehus/wallet-tracker/actions/runs/39248991256) separately retained an API artifact containing its own HTML/JUnit/race summary |
| `qa/reports/python-junit.xml` | Local pytest JUnit; the same CI run separately retained its Python JUnit artifact |
| `playwright-report/` | Playwright HTML report and traces (CI artifact) |
| `qa/reports/selenium/` | Screenshot, page source and console of each failed Selenium test (CI artifact on failure) |
| `log/BUGS.md` | The project-wide defect register — the single source of truth |

---

## 9. How to run it

```bash
npm install

npm run check      # invariants
npm run check:openapi # source/schema inventory gate
npm run test:contract # contract and supporting controls; inspect the report for counts
npm run test:db     # 6 migration cases
npm run test:api   # Newman collection; inspect the generated report
npm run test:python # pytest API scenarios; Python 3.12+ and qa/python/requirements.txt
npm run test:e2e   # managed Playwright in phone and desktop projects
npm run test:e2e:runner # isolated main-E2E lifecycle controls
npm run test:selenium # pytest in headless Chrome; the same requirements
npm run test:load  # k6; needs k6 installed separately
```

Nothing needs to be started first: each layer starts a server of its own, on
its own port, with a throwaway database. `npm test` runs check, migration,
Newman, pytest, Playwright and race in order. Contract, AI, fixture evaluation
and Selenium use the separate commands in [test setup](../../docs/testing.md).
`npm test` is not the CI-equivalent plan; see [verification and retained-evidence
report](test-report-ci-verification.md) for the shared runner and exact local results.
The load smoke is separate because its numbers depend on the machine.

The main E2E command owns a fresh disposable SQLite directory per run and
waits for its loopback server to close before deleting that directory. Separate
users do not mean separate databases or IP login buckets inside one run. A
new, explicitly supplied `DB_PATH` is retained, never reused or cleaned as an
owned default. Direct Playwright invocation fails closed; use `npm run test:e2e`.
See the [isolation report](test-report-e2e-isolation.md) for measured controls
and limits. The published application snapshot has a [6/6 post-merge CI run](https://github.com/DaniilBehus/wallet-tracker/actions/runs/39248991256);
owner UAT remains a separate gate in the [current status](../../docs/qa-status.md).

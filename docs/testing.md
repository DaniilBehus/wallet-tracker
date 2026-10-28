**English** · [Slovenčina](../locales/sk/docs/testing.md)

# Running the tests

[← Back to README](../README.md#qa-evidence) · [Next: test plan →](../qa/docs/test-plan.md)

For the distinction between dated results, this uncommitted source tree,
release readiness and owner acceptance, see [current QA status](qa-status.md).

Install the application dependencies with `npm ci` first. Use stable Node.js `^22.14.0 || >=23.6.0` with Node-API 10+; the installed SQLite binding needs that API. The runtime guard rejects unsupported versions before native loading or database-directory creation. CI pins exact 22.14.0 to exercise the compatibility floor, not as a security recommendation; use a current patched supported LTS release for normal use. Also use Python 3.12+ for pytest, Chromium for Playwright and Google Chrome for Selenium. Install the browser with `npx playwright install chromium` (`--with-deps chromium` on Linux when system dependencies are needed). Set up Python using the commands below before running `npm test`. k6 is a separate installation.

```bash
npm run check        # invariants: spec hash, no float money, testids, e2e discipline, coverage gates
npm run verify:ci -- --plan # inspect all enforced groups; every task is NOT_RUN
npm run verify:ci  # all CI groups in order; requires gitleaks and browser/Python setup
npm run test:verify # negative controls for plan, fail-fast, evidence and CI wiring
node --test qa/runtime/runtime.test.js # version/API boundaries and early native guard
npm run test:gates   # local controls for required inputs, race safety and exceptions
npm run test:dates   # pure YYYY-MM-DD bounds, year 0000, rollover and overflow controls
npm run check:openapi # schema/local refs and source-derived route/auth/response inventory
npm run test:contract # contract and supporting controls; inspect the run report
npm run test:api     # Newman collection; inspect the generated report
npm run test:import  # offline synthetic batch and test-only loopback-adapter tests
npm run test:db      # migrations against temporary databases
npm run test:python  # isolated Python/httpx API items; writes JUnit XML
npm run test:e2e     # managed phone and desktop browser projects
npm run test:e2e:runner # isolated Node controls for the main E2E database lifecycle
npm run test:selenium # headless Chrome; -- --headed shows it
npm run test:race    # two server processes, one database, concurrent writes
npm test             # legacy subset, NOT the complete CI-equivalent verification
npm run test:load    # k6; needs k6 installed separately

npm run test:ai      # offline tests; one Windows file-symlink control may skip
npm run eval:ai      # fixture evaluation; MODEL_QUALITY=NOT_MEASURED
npm run test:ai:e2e  # AI browser scenarios with a local fake provider
npm run test:a11y    # WCAG-tagged axe checks, keyboard regression, local rendered-contrast evidence
```

Nothing needs to be started first: each layer starts a server of its own, with
an isolated database. The pytest fixture additionally allocates a loopback port
and JWT secret per run. UI scenarios use explicit or web-first waits instead
of arbitrary browser sleeps; startup readiness uses bounded health polling.

Normal `npm start` binds `127.0.0.1` unless `WALLET_HOST` is deliberately set;
an empty value and generic `HOST` do not broaden it. The managed E2E runner
discards inherited `WALLET_HOST`/`HOST` and requires the production three-argument
loopback listen signature before starting its disposable browser session. The
[focused local modal/bind report](../qa/docs/test-report-modal-bind.md) separates
source controls, browser behavior and deployment limits.

For focused pagination regression, run
`node qa/e2e-runner/run.js qa/e2e/pagination.spec.js` and
`node --test qa/contract/contract.test.js`. The
[F05 local report](../qa/docs/test-report-pagination-consistency.md) distinguishes
legacy offset drift, opt-in cursor HTTP behavior and Month's bounded refresh;
these runs do not replace full combined-tree or remote CI verification.

For focused financial-write and stale-response regressions, run
`node qa/e2e-runner/run.js qa/e2e/double-submit.spec.js qa/e2e/month.spec.js --grep 'support_control:'`
and `node --test qa/contract/contract.test.js`. The
[F06/F10 local report](../qa/docs/test-report-write-lifecycle.md) records the
controlled pre-repair failures, local outcomes and one unresolved full-run
fixture failure. These supplemental browser checks are not extra catalogue
case IDs or a replacement for the full managed suite.

For schedule-edit UI checks, run
`node qa/e2e-runner/run.js qa/e2e/schedules.spec.js --grep 'support_control:' --workers=4`
and `node --test qa/contract/contract.test.js`. The
[F09 local report](../qa/docs/test-report-schedule-editing.md) separates the
initial missing-control failure, the diagnosed editor-selector failure, the
repaired persisted browser behavior and pending independent/release gates.
These controls supplement, not renumber, the catalogue.

The main Playwright suite must start through `npm run test:e2e` (or the same
managed runner in the shared CI plan), not a direct `playwright test`. Its parent
process starts a loopback Wallet server with AI disabled and a fresh temporary
SQLite directory for each invocation. Specs create separate users but share that
one server/database and its IP-based login limiter *within* a run. The parent
waits for both browser and server processes to close before removing only its
own default directory; it never opens or deletes the old `data/e2e.db` or the
application `data/wallet.db`. No `.env`, provider key or external API target is
loaded or passed to these children. A preoccupied port fails rather than reusing
an unrelated server.

For a deliberate `DB_PATH` override, provide a **new** `.db` file under an
existing canonical directory. Existing files, links/aliases, SQLite sidecars
and the application/old E2E paths are refused before startup. The runner
reserves the new file exclusively and **retains it** afterward for the caller;
it never recursively removes that caller directory. `QA_BASE_URL` is refused;
`QA_E2E_PORT` may select a free local port (default 3002). Concurrent commands
cannot share a fixed port. Forced termination of the parent can leave an owned
temporary directory, which is not swept by later runs. [Local controls and
limits](../qa/docs/test-report-e2e-isolation.md) do not establish remote CI.

For a bounded Save/Enter regression, run
`node qa/e2e-runner/run.js qa/e2e/double-submit.spec.js`; the [F22 focused report](../qa/docs/test-report-retry-busy.md)
records exactly which mobile/desktop cases and negative controls ran. CI keeps
one diagnostic Playwright retry, but a retry-only pass is `flaky` and exits
nonzero there. `retain-on-first-failure` preserves the first failed attempt's
trace. Each invocation writes a fresh ignored
`qa/reports/playwright-main/results-<run-id>.json`; inspect its `stats`, test
outcomes and attempt statuses **from that run**, not an older JSON left on
disk. The e2e failure artifact uploads that JSON pattern, HTML report and
traces for seven days; this local wiring is not proof of a remote upload.

`verify:ci` uses one [shared task inventory](../scripts/verification-plan.js)
for the local runner and six existing CI job groups: secret history scan, API,
Python, Playwright/accessibility, Selenium and offline AI/browser. The default
has no skip-to-green option: a missing `gitleaks` or other prerequisite fails
the current task and marks every later task `NOT_RUN`. `--plan` executes nothing
and says `NOT_RUN`, not PASS. For a bounded layer, use `-- --group api` or
`-- --group python`; a group PASS is not a full-plan PASS. k6 and live-model
evaluation remain separate measured/authorized work.

The runner starts the established offline/disposable scripts directly. It does
not load `.env` or pass an inherited external API URL, provider key or database
path into children; Python remains selectable through `PYTHON`. Each attempted
run writes a compact ignored summary under `qa/reports/verification/` with a
unique identity, HEAD, dirty flag and a source-content fingerprint. That hash
covers Git-listed tracked and non-ignored untracked files at invocation; it
does not attest ignored files, dependencies, the environment, Git history or
later source edits. Only inspected API HTML/JUnit, Python JUnit and race JSON
are copied into that run's allowlisted evidence directory. A missing or unsafe
required report fails a successful producer. The [focused local report](../qa/docs/test-report-ci-verification.md)
records what actually ran and what remains unverified remotely.

The [validator-control report](../qa/docs/test-report-validator-controls.md)
records a negative-before/positive-after check of the self-check and race
runner. The race command now fails on missing execution evidence or any
enforcing scenario violation, including registration E. Scenario D reports
duplicate retries but is deliberately measurement-only: a passing race command
does **not** mean unkeyed retries are idempotent. Each run owns and removes only
its validated temporary database directory after both servers stop. Fixed
ports 3110/3111 mean concurrent race commands are not supported.

To prepare the Python layer locally (Python 3.12+):

```bash
python -m venv .venv
.venv\Scripts\python -m pip install -r qa/python/requirements.txt  # Windows
npm run test:python
```

On macOS/Linux, install the same requirements with `.venv/bin/python -m pip install -r qa/python/requirements.txt`. The runner detects the local virtual environment.

End-to-end and pytest scenarios that invoke the catalogue helpers carry an id
(`TC-…`) from [`qa/docs/test-cases.md`](../qa/docs/test-cases.md). The helper
rejects an unknown id when invoked; it does not require every scenario to
invoke it. [Executable traceability remains incomplete](qa-status.md#open-gates).

| Evidence | What you will find |
|---|---|
| [`qa/docs/test-design.md`](../qa/docs/test-design.md) | How a change becomes a set of cases — nine steps, each with an example from this app |
| [`qa/docs/test-plan.md`](../qa/docs/test-plan.md) | Scope, entry and exit criteria, risks |
| [`qa/docs/test-cases.md`](../qa/docs/test-cases.md) | Dated case catalogue with IDs and rule/defect links; it is not a generated current executable inventory or a new CI result |
| [`docs/api/README.md`](api/README.md) | OpenAPI contract, synthetic examples and contract-check requirements |
| [`qa/docs/test-report-contract.md`](../qa/docs/test-report-contract.md) | Local observed-status matrix, validator controls, regression results and limitations |
| [`qa/docs/test-report-api-validation.md`](../qa/docs/test-report-api-validation.md) | Current safe-integer and text-coercion HTTP regressions; preserved input compatibility |
| [`qa/docs/test-report-evaluator-concurrency.md`](../qa/docs/test-report-evaluator-concurrency.md) | Atomic synthetic setup, concurrent immutable reports and offline W9 regression evidence |
| [`qa/docs/test-report-date-boundaries.md`](../qa/docs/test-report-date-boundaries.md) | Four-digit date domain, schedule overflow refusal and disposable HTTP evidence |
| [`qa/docs/test-report-runtime.md`](../qa/docs/test-report-runtime.md) | Node/Node-API floor, early native guard and focused local proof limits |
| [`qa/db/`](../qa/db/) | Existing-database migration checks on disposable files |
| [`qa/docs/defects/`](../qa/docs/defects/) | Full defect reports from the test layers |
| [`qa/api/`](../qa/api/) | Postman collection; the environment holds two variables and no literals |
| [`qa/python/`](../qa/python/) | pytest + httpx scenarios; a real Express child, temporary SQLite, health check and JUnit XML |
| [`qa/e2e/`](../qa/e2e/) | Playwright specs and page objects |
| [`qa/docs/test-report-e2e-isolation.md`](../qa/docs/test-report-e2e-isolation.md) | Main E2E database lifecycle controls and remaining limits |
| [`qa/docs/test-report-retry-busy.md`](../qa/docs/test-report-retry-busy.md) | Focused real Save/Enter cases, controlled busy failure and first-failure retry evidence |
| [`qa/docs/accessibility-baseline.md`](../qa/docs/accessibility-baseline.md) | Accessibility gate, local scan evidence, keyboard fix and unresolved contrast targets |
| [`qa/selenium/`](../qa/selenium/) | Selenium WebDriver + pytest checks with Page Objects, explicit waits and failure evidence |
| [`qa/race/`](../qa/race/) | Concurrency checks against two real server processes |
| [`qa/load/`](../qa/load/) | k6 scripts; each measures the same endpoint idle and under load |
| [`qa/ai/`](../qa/ai/) | AI layer: fake providers, network guard, evaluator, demo runner, corpus and fixtures |
| [`qa/docs/ai-test-plan.md`](../qa/docs/ai-test-plan.md) | AI risks, layers and the TC-AI case register |
| [`qa/docs/ai-case-study.md`](../qa/docs/ai-case-study.md) | What testing the AI entry actually found, and what fixtures cannot prove |

The end-to-end suite selects only by `getByTestId` and `getByRole`, waits only
through web-first assertions, and each spec creates its own user through the API
so nothing depends on execution order. Those are not conventions — `check.js`
fails the build if a `.locator()` or a `waitForTimeout` appears. Three more
static gates compare route and request declarations (C6), literal testids and
page-object addressability (C7), and source status literals with assertion
declarations globally (C8). They do not prove that each endpoint/status was
executed. C9 rejects stale, redundant, duplicate or unexplained exceptions.
Runtime evidence is separate: the [contract report and operation/status
matrix](../qa/docs/test-report-contract.md#observed-status-matrix) distinguish
observed responses from NOT EXERCISED cells. The 500 exception is an
unexercised static gap, not proof that controlled 500 testing is impossible.
The [focused static-gate report](../qa/docs/test-report-static-gates.md) records
the negative controls, local result, and the scanner's limits.

The separate accessibility command starts its own offline demo server and
disposable database. It fails on automatically detected WCAG-tagged axe
violations, attaches full JSON including inconclusive outcomes, and checks
bounded keyboard and known solid-surface contrast behavior. Its HTML report
and screenshots stay in ignored `qa/reports/playwright-a11y/` and
`test-results/a11y/`. The workflow addition is committed in local HEAD `b270355`;
neither that commit nor this document establishes a freshly verified remote
run for the current uncommitted tree.

## Contract checks and the full regression

`npm test` still excludes OpenAPI/contract, synthetic import, AI, fixture evaluation, Selenium and accessibility; it is not CI-equivalent. `verify:ci` plans those enforced layers plus the history secret scan. k6 additionally requires its own installation and is not an enforced CI task. Committed workflow wiring is not proof of a new GitHub run for this uncommitted tree. The [synthetic batch tests](../qa/import/synthetic-import.test.js) and [loopback HTTP adapter tests](../qa/import/provider-adapter.test.js) use disposable offline fixtures and run under the API group. A fixed synthetic-demo browser preview/confirm is covered by [the browser spec](../qa/e2e/synthetic-import.spec.js). The loopback adapter exists **only as a test demonstrator**; the product has no external provider connector or bank integration. Its business assumptions remain [provisional](../qa/docs/analysis-synthetic-import.md).

Contract tests start two real servers on loopback-only ephemeral ports, with
temporary SQLite, random secrets and an allow-listed environment. AI is off or
canned demo, guarded against external network connections. Captures stay in
memory; stdout contains the operation/status matrix, not JWTs or raw bodies.
See the [API guide](api/README.md) and [local report](../qa/docs/test-report-contract.md).

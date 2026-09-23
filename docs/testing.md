# Running the tests

[← Back to Wallet Tracker](../README.md#qa-evidence)

Install the application dependencies with `npm ci` first. Use Node.js 22+, Python 3.12+ for pytest, and Chromium for Playwright. Install the browser with `npx playwright install chromium` (`--with-deps chromium` on Linux when system dependencies are needed). Set up Python using the commands below before running `npm test`. k6 is a separate installation.

```bash
npm run check        # invariants: spec hash, no float money, testids, e2e discipline, coverage gates
npm run test:api     # 171 requests, 621 assertions
npm run test:db      # 3 migration cases against temporary databases
npm run test:python  # 16 isolated Python/httpx API scenarios; writes JUnit XML
npm run test:e2e     # 69 scenarios across a phone and a desktop viewport
npm run test:race    # two server processes, one database, concurrent writes
npm test             # check, migration, Newman, pytest, Playwright and race checks
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

On macOS/Linux, install the same requirements with `.venv/bin/python -m pip install -r qa/python/requirements.txt`. The runner detects the local virtual environment.

End-to-end and pytest scenarios that implement a catalogued case carry its id
(`TC-…`) from [`qa/docs/test-cases.md`](../qa/docs/test-cases.md). An id that the
catalogue does not list fails before the test runs.

| Evidence | What you will find |
|---|---|
| [`qa/docs/test-design.md`](../qa/docs/test-design.md) | How a change becomes a set of cases — nine steps, each with an example from this app |
| [`qa/docs/test-plan.md`](../qa/docs/test-plan.md) | Scope, entry and exit criteria, risks |
| [`qa/docs/test-cases.md`](../qa/docs/test-cases.md) | 186 cases with ids, priorities, results and a trace to a requirement, spec clause or defect |
| [`qa/db/`](../qa/db/) | Existing-database migration checks on disposable files |
| [`qa/docs/defects/`](../qa/docs/defects/) | Full defect reports from the test layers |
| [`qa/api/`](../qa/api/) | Postman collection; the environment holds two variables and no literals |
| [`qa/python/`](../qa/python/) | pytest + httpx scenarios; a real Express child, temporary SQLite, health check and JUnit XML |
| [`qa/e2e/`](../qa/e2e/) | Playwright specs and page objects |
| [`qa/race/`](../qa/race/) | Concurrency checks against two real server processes |
| [`qa/load/`](../qa/load/) | k6 scripts; each measures the same endpoint idle and under load |
| [`qa/ai/`](../qa/ai/) | AI layer: fake providers, network guard, evaluator, demo runner, corpus and fixtures |
| [`qa/docs/ai-test-plan.md`](../qa/docs/ai-test-plan.md) | AI risks, layers and the TC-AI case register |
| [`qa/docs/ai-case-study.md`](../qa/docs/ai-case-study.md) | What testing the AI entry actually found, and what fixtures cannot prove |

The end-to-end suite selects only by `getByTestId` and `getByRole`, waits only
through web-first assertions, and each spec creates its own user through the API
so nothing depends on execution order. Those are not conventions — `check.js`
fails the build if a `.locator()` or a `waitForTimeout` appears. Three more
gates ask whether what exists is covered: every route has a request, every
testid is addressed from a page object, every status the server can return is
provoked by some case. Exceptions live in one file with a written reason each;
an exception with an empty reason fails the build too.

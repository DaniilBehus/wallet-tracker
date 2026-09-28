# Selenium browser checks

[← Running the tests](../../docs/testing.md) · [The cases](../docs/test-cases.md#selenium--browser-checks--qaselenium)

A small browser suite in Python: Selenium WebDriver, pytest and Page Objects,
checking nine of Wallet's key flows in Chrome — eleven runs, because one case runs
once per limit state and one flow runs again at phone width.

## Why Selenium, next to Playwright

Playwright ([`qa/e2e/`](../e2e/), 93 tests on two viewports) is the project's
end-to-end layer and stays so. This suite exists because many teams test the
browser with Selenium and Python, and the project shows that way of working on
the same app, done with the same care. It does not fill a gap Playwright left.
The overlap is deliberate and kept small: nine flows the app cannot afford to
lose, checked again through a different driver, so this stays a short suite
rather than a second one to maintain.

## What is where

```text
qa/selenium/
  conftest.py      the server, reused from qa/python/conftest.py; Chrome; --headed; the evidence hook
  suite_rules.py   refuses a run whose code sleeps, waits implicitly or locates by position
  wallet_api.py    test data through the API: a fresh account for every test
  browser_logs.py  a response header, read from Chrome's network log
  evidence.py      the screenshot, page source and console of a failed test
  pages/           Page Objects: base, auth, add, month, upcoming — every locator lives here
  test_*.py        the checks, TC-SEL-001 to 009
  run.js           what npm run test:selenium starts
```

Each run starts the app on a free port with a temporary database and secret,
and gives every test a fresh Chrome, so nothing needs to be running first and
no test depends on another. The report goes to `qa/reports/selenium-junit.xml`.

## Running it

It needs Node.js 22+, Python 3.12+ with `qa/python/requirements.txt` (which
pins `selenium`), and Google Chrome. Selenium Manager, part of Selenium, finds
the installed Chrome and downloads the ChromeDriver that matches it into its own
cache on the first run; no driver is kept in the repository.

Windows, in PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r qa/python/requirements.txt
npm run test:selenium
npm run test:selenium -- --headed      # show the browser
npm run test:selenium -- -k limit      # only the tests with "limit" in their name
```

Linux, where the CI job runs it on `ubuntu-latest` with the runner's Chrome:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r qa/python/requirements.txt
npm run test:selenium
```

## Locators and waits

- **Locators come from `data-testid` attributes, then labels and roles.** The
  app keeps those ids for its tests (spec §5), so a restyle or a moved element
  does not break a test whose behaviour did not change.
- **No XPath that counts positions and no CSS chains that follow the layout.**
  They break on edits that have nothing to do with the behaviour under test.
- **Every wait is a `WebDriverWait` on a condition.** A fixed sleep is either
  too long on a fast machine or too short on a slow one.
- **The implicit wait is fixed at 0.** Otherwise every lookup waits silently,
  and a missing element costs its timeout on each attempt instead of failing at
  the line that needed it.
- **The data comes through the API, a fresh account per test.** The browser
  does only the behaviour a test is about, so tests are fast and pass alone and
  in any order.

`suite_rules.py` reads the suite's code before any test runs and stops the run,
naming file and line, on a sleep, a non-zero implicit wait, a positional XPath
or a CSS selector bound to the layout. Two things look unusual and are
deliberate: clicks scroll the element to the middle of its scroll area first,
because the app's bottom navigation is fixed over every screen and WebDriver
scrolls an element only to the edge of the view, where the navigation can cover
it; and TC-SEL-008 narrows the page through Chrome's DevTools, because a
desktop window cannot be made narrower than about 500 px when it is shown.

## Reading a failure

A test that fails while it has a browser leaves a folder,
`qa/reports/selenium/<test>/`, and the failure report names it:

| File | What it holds |
|---|---|
| `screenshot.png` | What the page showed when the test failed |
| `page.html` | The page source at that moment: text, attributes, test ids |
| `console.txt` | The page's address and everything it wrote to its console |
| `not-saved.txt` | Only when a part could not be saved, such as after a browser crash |

Start with the assertion message and the screenshot side by side: most
failures are the page showing something else than the test expected. Then read
the console for errors — a failed request appears there with its status — and
the page source for an element's text or attributes. An error message on the
screen carries a *Reference*; the [runbook](../../docs/support/runbook.md#3-find-one-request-by-its-reference)
shows how to find that request in the server log.

The folder is emptied when a run starts, so it only ever holds the last run.
In CI, the job uploads it as the `selenium-evidence` artifact when it fails,
for a week: open the failed run, then *Artifacts* on its summary page.

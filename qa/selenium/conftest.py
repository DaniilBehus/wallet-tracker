"""Fixtures for the Selenium browser suite; every run owns its server and browser.

The server is the API layer's own fixture, reused rather than copied: the real
app on a free port, with a temporary database and a throwaway secret that last
one session (qa/python/conftest.py). What this file adds is the browser.

Chrome is found, and matched with its driver, by Selenium Manager, so no driver
is downloaded by hand or kept in the repository. It runs headless unless pytest
is given --headed. The implicit wait is fixed at zero: every wait in this suite
is an explicit WebDriverWait on a condition, and suite_rules.py refuses a run
whose code sleeps, waits implicitly or locates by position.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest
from selenium import webdriver

from pages.add_page import AddPage
from suite_rules import violations
from wallet_api import Account


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]

# The tests take their case ids from the API layer's case_link.py, which
# refuses an id that qa/docs/test-cases.md does not list.
sys.path.append(str(ROOT / "qa" / "python"))


def _api_layer():
    """qa/python/conftest.py, loaded under a name of its own.

    Both files are called conftest.py, so a plain import would find this one.
    """
    spec = importlib.util.spec_from_file_location("wallet_api_layer_conftest", ROOT / "qa" / "python" / "conftest.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module  # its dataclass looks itself up there while it is defined
    spec.loader.exec_module(module)
    return module


_api = _api_layer()
server = _api.server  # session: the app on a free port, its temporary database and secret
api = _api.api        # session: an httpx client for that server, for setting up data


def pytest_addoption(parser: pytest.Parser) -> None:
    parser.addoption("--headed", action="store_true", help="show the Chrome window instead of running headless")


def pytest_sessionstart(session: pytest.Session) -> None:
    problems = violations(HERE)
    if problems:
        raise pytest.UsageError("qa/selenium breaks its own rules:\n  " + "\n  ".join(problems))


@pytest.fixture
def driver(request: pytest.FixtureRequest):
    """A fresh Chrome for each test: no cookies, storage or history carry over."""
    options = webdriver.ChromeOptions()
    if not request.config.getoption("--headed"):
        options.add_argument("--headless=new")
    options.add_argument("--window-size=1280,900")
    # A new profile still offers to save passwords and checks them against
    # breach lists; either can put a browser dialog over the page when headed.
    options.add_experimental_option(
        "prefs",
        {
            "credentials_enable_service": False,
            "profile.password_manager_enabled": False,
            "profile.password_manager_leak_detection": False,
        },
    )
    # The network events, so a test can read a response header (browser_logs.py).
    options.set_capability("goog:loggingPrefs", {"performance": "ALL"})

    browser = webdriver.Chrome(options=options)
    browser.implicitly_wait(0)
    yield browser
    browser.quit()


@pytest.fixture
def account(api) -> Account:
    """A brand-new account for one test, made through the API."""
    return Account.register(api)


@pytest.fixture
def signed_in(driver, server, account):
    """The app open in the browser as `account`, without the sign-in screen.

    Signing in is tested once, through the form (test_auth.py). Everywhere else
    the session is handed to the app the way it keeps one, in localStorage.
    """
    driver.get(server.base_url)
    driver.execute_script("window.localStorage.setItem('wallet_token', arguments[0]);", account.token)
    driver.refresh()
    AddPage(driver).wait_until_open()
    return driver

"""What Chrome recorded beside the page: its network log.

The driver fixture asks Chrome to keep a performance log, which holds the
DevTools network events. That is how a test reads a response header the page
received — the request id behind a Reference — without trusting the screen
for it and without changing the page.
"""

from __future__ import annotations

import json

from selenium.webdriver.remote.webdriver import WebDriver


def response_header(driver: WebDriver, path: str, status: int, name: str) -> str:
    """One header of the response the page got from `path` with `status`."""
    for entry in driver.get_log("performance"):
        event = json.loads(entry["message"])["message"]
        if event.get("method") != "Network.responseReceived":
            continue
        response = event["params"]["response"]
        if response["url"].endswith(path) and response["status"] == status:
            headers = {key.lower(): value for key, value in response["headers"].items()}
            return headers[name.lower()]
    raise AssertionError(f"Chrome's network log has no {status} response from {path}")

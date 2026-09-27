"""What a failed test leaves behind: a screenshot, the page source and the console.

Each failed test gets a folder under qa/reports/selenium/, which git ignores and
CI uploads only when the job fails. The folder is emptied when a run starts, so
everything in it belongs to the last run.
"""

from __future__ import annotations

import re
import shutil
from datetime import datetime
from pathlib import Path

from selenium.webdriver.remote.webdriver import WebDriver


FOLDER = Path(__file__).resolve().parents[2] / "qa" / "reports" / "selenium"


def reset() -> None:
    shutil.rmtree(FOLDER, ignore_errors=True)


def save(driver: WebDriver, test_id: str) -> Path:
    """Keep what the browser showed and wrote; return the folder it went to."""
    target = FOLDER / re.sub(r"[^\w.-]+", "_", test_id.removeprefix("qa/selenium/")).strip("_")
    target.mkdir(parents=True, exist_ok=True)

    problems = []
    for name, write in (("screenshot.png", _screenshot), ("page.html", _page), ("console.txt", _console)):
        # A browser that crashed must not replace the test's own failure with
        # one from here, so a part that cannot be saved is noted and skipped.
        try:
            write(driver, target / name)
        except Exception as exc:
            problems.append(f"{name}: {type(exc).__name__}: {exc}")
    if problems:
        (target / "not-saved.txt").write_text("\n".join(problems) + "\n", encoding="utf-8")
    return target


def _screenshot(driver: WebDriver, path: Path) -> None:
    if not driver.save_screenshot(str(path)):
        raise RuntimeError("the driver did not write a screenshot")


def _page(driver: WebDriver, path: Path) -> None:
    path.write_text(driver.page_source, encoding="utf-8")


def _console(driver: WebDriver, path: Path) -> None:
    lines = [f"url: {driver.current_url}"]
    for entry in driver.get_log("browser"):
        when = datetime.fromtimestamp(entry["timestamp"] / 1000).isoformat(timespec="milliseconds")
        lines.append(f"{when} {entry['level']} {entry['message']}")
    if len(lines) == 1:
        lines.append("(the page wrote nothing to its console)")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")

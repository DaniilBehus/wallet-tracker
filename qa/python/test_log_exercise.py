"""docs/support/log-exercise.md quotes docs/support/exercise.log exactly.

scripts/support-exercise.js writes the log from a real run, and every run gives
new ids and times. A log regenerated without rewriting the page would leave the
worked answer pointing at lines that no longer exist; this test fails first.
It needs no server: it reads the two committed files.
"""

from __future__ import annotations

import json
import re

from conftest import ROOT
from case_link import case


PAGE = ROOT / "docs" / "support" / "log-exercise.md"
LOG = ROOT / "docs" / "support" / "exercise.log"


@case("TC-PY-017")
def test_the_exercise_quotes_its_log_exactly():
    page = PAGE.read_text(encoding="utf-8")
    log = LOG.read_text(encoding="utf-8")
    log_lines = log.splitlines()
    records = [json.loads(line) for line in log_lines if line.startswith("{")]

    quoted = [
        line
        for block in re.findall(r"```text\n(.*?)```", page, flags=re.S)
        for line in block.splitlines()
        if line.startswith("{")
    ]
    assert quoted, "the worked answer quotes no log lines"
    missing = [line for line in quoted if line not in log_lines]
    assert not missing, f"quoted on the page but not in the log: {missing}"

    # The first question's reference is the planted failure: the log's only
    # 500, with the UNHANDLED line of the same request.
    failures = [r for r in records if r.get("event") == "request" and r.get("status") == 500]
    assert len(failures) == 1, f"expected one 500 in the log, found {len(failures)}"
    request_id = failures[0]["request_id"]
    assert f"**Reference `{request_id[:8]}`.**" in page
    assert any(r.get("event") == "UNHANDLED" and r.get("request_id") == request_id for r in records)

    # The file is public: no machine's folders and no e-mail addresses in it.
    assert not re.search(r"[A-Za-z]:\\\\|/home/|/Users/|\\\\Users\\\\", log)
    assert "@" not in log

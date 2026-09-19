"""Links a pytest scenario to its local test case in qa/docs/test-cases.md.

An id the catalogue does not list raises at import time, so a typo can never
produce a scenario that looks traced but is not.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest


_CATALOGUE = Path(__file__).parents[1] / "docs" / "test-cases.md"
_IDS = set(re.findall(r"\bTC-[A-Z0-9]+-\d{3}\b", _CATALOGUE.read_text(encoding="utf-8")))


def case(local_id: str):
    """Return a `case` marker for an id the local catalogue lists."""
    if local_id not in _IDS:
        raise ValueError(f"{local_id} is not listed in qa/docs/test-cases.md")
    return pytest.mark.case(local_id)

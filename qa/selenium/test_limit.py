"""The monthly limit on screen: the status box and clearing the limit (UAT-OBS-01)."""

from __future__ import annotations

import re

import pytest

from case_link import case
from pages.month_page import MonthPage


WHITE = (255, 255, 255, 1.0)


def rgba(css: str) -> tuple[int, int, int, float]:
    """'#c0392b', 'rgb(…)' or 'rgba(…)' as numbers, so a token and a computed colour compare."""
    css = css.strip()
    if css.startswith("#"):
        return (int(css[1:3], 16), int(css[3:5], 16), int(css[5:7], 16), 1.0)
    parts = [float(p) for p in re.findall(r"[\d.]+", css)]
    return (int(parts[0]), int(parts[1]), int(parts[2]), parts[3] if len(parts) > 3 else 1.0)


@case("TC-SEL-004")
@pytest.mark.parametrize(
    "limit, spent, sentence, used_up",
    [
        pytest.param(20000, 5000, "Within limit · €150.00 left", False, id="within"),
        pytest.param(10000, 10000, "Limit reached", True, id="exactly-at"),
        pytest.param(10000, 12500, "Over limit by €25.00", True, id="over"),
    ],
)
def test_the_status_box_follows_the_limit(signed_in, account, limit, spent, sentence, used_up):
    account.set_settings(150000, limit)
    account.add_expense(spent, "Groceries")

    month = MonthPage(signed_in).open()
    month.wait_for_text(month.LIMIT_STATUS, sentence)
    box = month.status_box()

    if used_up:
        # Nothing left, so a solid red box with white text; exactly at the limit
        # still reads "reached", and only over the limit is marked over.
        assert rgba(box["fill"]) == rgba(box["used_up"]), box
        assert rgba(box["text"]) == WHITE, box
        assert ("figure--over" in box["classes"]) == sentence.startswith("Over"), box
    else:
        # Budget left: a white outline and no fill.
        assert rgba(box["fill"])[3] == 0, box
        assert rgba(box["border"]) == rgba(box["outline"]) == WHITE, box
    # The limit figure itself is never framed.
    assert month.limit_figure_border() == ["0px"] * 4


@case("TC-SEL-005")
def test_clearing_the_limit_removes_the_box_and_offers_to_set_one(signed_in, account):
    account.set_settings(150000, 20000)

    month = MonthPage(signed_in).open()
    month.wait_for_text(month.LIMIT_STATUS, "Within limit · €200.00 left")

    month.set_limit("")

    month.wait_for_text(month.LIMIT_VALUE, "Set limit")
    month.wait_hidden(month.LIMIT_STATUS)
    assert month.limit_figure_border() == ["0px"] * 4
    assert account.settings()["monthly_limit_cents"] is None

"""Saving an expense and editing one, seen on the month screen."""

from __future__ import annotations

import pytest

from case_link import case
from pages.add_page import AddPage
from pages.month_page import MonthPage
from wallet_api import eur


@pytest.mark.parametrize(
    "phone",
    [
        pytest.param(False, marks=case("TC-SEL-003"), id="desktop"),
        pytest.param(True, marks=case("TC-SEL-008"), id="phone-375"),
    ],
)
def test_an_expense_saved_on_the_keypad_joins_the_month(signed_in, account, phone):
    if phone:
        assert AddPage(signed_in).use_phone_width(375) == 375
    account.add_expense(1250, "Transport", "Bus pass")

    month = MonthPage(signed_in).open()
    month.wait_for_text(month.TOTAL, eur(1250))
    assert month.row_count() == 1

    month.go_to("add")
    add = AddPage(signed_in).wait_until_open()
    add.add_expense(740, account.categories["Groceries"], "Selenium lunch")
    add.wait_for_success()

    month.open()
    month.wait_for_text(month.TOTAL, eur(1250 + 740))
    month.wait_for_row_count(2)
    row = month.row_named("Selenium lunch")
    assert "Groceries" in row and eur(740) in row, row


@case("TC-SEL-006")
def test_editing_only_the_note_keeps_an_expense_uncategorised(signed_in, account):
    """BUG-015: the editor turned "no category" into category 0 and the save was refused."""
    expense = account.add_expense(1840, category=None, note="Market")

    month = MonthPage(signed_in).open()
    assert "Uncategorised" in month.row_named("Market")

    month.edit_note(expense["id"], "Farmers market")

    row = month.row_named("Farmers market")
    assert "Uncategorised" in row and eur(1840) in row, row
    stored = account.expense(expense["id"])
    assert stored["note"] == "Farmers market"
    assert stored["category_id"] is None

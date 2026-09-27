"""Paying a loan instalment from Upcoming."""

from __future__ import annotations

from case_link import case
from pages.upcoming_page import UpcomingPage
from wallet_api import eur


@case("TC-SEL-007")
def test_paying_an_instalment_counts_the_loan_down(signed_in, account):
    loan = account.add_loan("Laptop loan", instalment_cents=5000, instalments=3)

    upcoming = UpcomingPage(signed_in).open()
    upcoming.wait_for_text(upcoming.remaining(loan["id"]), f"3 of 3 left · {eur(15000)}")

    upcoming.pay(loan["id"])
    upcoming.wait_for_success()

    upcoming.wait_for_text(upcoming.remaining(loan["id"]), f"2 of 3 left · {eur(10000)}")
    stored = account.schedule(loan["id"])
    assert (stored["paid_count"], stored["remaining_count"]) == (1, 2)

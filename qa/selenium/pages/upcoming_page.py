"""Screen 6.3: active schedules, each with a pay button and, for a loan, a countdown."""

from __future__ import annotations

from pages.base_page import BasePage, testid


class UpcomingPage(BasePage):
    @staticmethod
    def remaining(schedule_id: int) -> tuple[str, str]:
        """'2 of 3 left · €100.00' for a loan."""
        return testid(f"schedule-remaining-{schedule_id}")

    @staticmethod
    def pay_button(schedule_id: int) -> tuple[str, str]:
        return testid(f"schedule-pay-{schedule_id}")

    def open(self) -> "UpcomingPage":
        self.go_to("upcoming")
        return self

    def pay(self, schedule_id: int) -> None:
        self.click(self.pay_button(schedule_id))

"""The sign-in and registration screen."""

from __future__ import annotations

from pages.base_page import BasePage, testid


class AuthPage(BasePage):
    EMAIL = testid("auth-email")
    PASSWORD = testid("auth-password")
    SUBMIT = testid("auth-submit")
    # Switches the same form between signing in and creating an account.
    TOGGLE = testid("auth-toggle")

    def open(self, base_url: str) -> "AuthPage":
        self.driver.get(base_url)
        self.visible(self.EMAIL)
        return self

    def register(self, email: str, password: str) -> None:
        self.click(self.TOGGLE)
        self._submit(email, password)

    def sign_in(self, email: str, password: str) -> None:
        self._submit(email, password)

    def _submit(self, email: str, password: str) -> None:
        self.type_into(self.EMAIL, email)
        self.type_into(self.PASSWORD, password)
        self.click(self.SUBMIT)

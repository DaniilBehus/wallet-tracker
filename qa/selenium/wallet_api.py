"""Test data through the API: a fresh account per test, fast and independent.

The browser is kept for the behaviour a test is about. Everything a test only
needs to exist first — an account, a limit, an expense, a loan — is made here,
with the same httpx client the API layer uses.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass, field
from typing import Any

import httpx


def new_credentials() -> tuple[str, str]:
    """A unique e-mail and a password nobody has used, for one account."""
    return f"selenium-{secrets.token_hex(6)}@example.test", f"sel-{secrets.token_hex(10)}"


def eur(cents: int) -> str:
    """Money as the screens write it: 125000 -> '€1,250.00'."""
    return f"€{abs(cents) // 100:,}.{abs(cents) % 100:02d}"


@dataclass
class Account:
    client: httpx.Client
    email: str
    password: str
    token: str
    categories: dict[str, int] = field(default_factory=dict)  # name -> id

    @classmethod
    def register(cls, client: httpx.Client) -> "Account":
        email, password = new_credentials()
        response = client.post("/api/auth/register", json={"email": email, "password": password})
        assert response.status_code == 201, response.text
        account = cls(client, email, password, response.json()["token"])
        account.categories = {c["name"]: c["id"] for c in account.call("GET", "/api/categories")}
        return account

    def call(self, method: str, path: str, expected: int = 200, **kwargs: Any) -> Any:
        response = self.client.request(method, path, headers={"Authorization": f"Bearer {self.token}"}, **kwargs)
        assert response.status_code == expected, f"{method} {path} -> {response.status_code} {response.text}"
        return response.json() if response.content else None

    def set_settings(self, income_cents: int | None, limit_cents: int | None) -> dict:
        body = {"monthly_income_cents": income_cents, "monthly_limit_cents": limit_cents}
        return self.call("PUT", "/api/settings", json=body)

    def settings(self) -> dict:
        return self.call("GET", "/api/settings")

    def add_expense(self, cents: int, category: str | None = None, note: str | None = None) -> dict:
        """An expense this month; `category` is a name, or None for an uncategorised one."""
        body = {"amount_cents": cents, "category_id": self.categories[category] if category else None, "note": note}
        return self.call("POST", "/api/transactions", 201, json=body)

    def expense(self, transaction_id: int) -> dict:
        items = self.call("GET", "/api/transactions", params={"limit": 100})["items"]
        return next(item for item in items if item["id"] == transaction_id)

    def add_loan(self, name: str, instalment_cents: int, instalments: int) -> dict:
        body = {
            "name": name,
            "amount_cents": instalment_cents,
            "day_of_month": 15,
            "starts_on": "2026-01-01",
            "total_count": instalments,
        }
        return self.call("POST", "/api/schedules", 201, json=body)

    def schedule(self, schedule_id: int) -> dict:
        return next(item for item in self.call("GET", "/api/schedules") if item["id"] == schedule_id)

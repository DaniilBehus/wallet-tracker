"""Keyed saves and the AI endpoints from an independent client (D-033–D-035).
"""

from __future__ import annotations

import secrets
from concurrent.futures import ThreadPoolExecutor
from datetime import date

import httpx

from conftest import auth


def keyed(user: dict[str, object], key: str) -> dict[str, str]:
    return {**auth(user), "Idempotency-Key": key}


def count(api: httpx.Client, user: dict[str, object]) -> int:
    response = api.get("/api/transactions?from=1900-01-01&to=2999-12-31&limit=200", headers=auth(user))
    assert response.status_code == 200, response.text
    return response.json()["total"]


def test_parallel_retries_with_one_key_create_one_expense(server, make_user):
    user = make_user("keyed-burst")
    key = f"py-{secrets.token_hex(8)}"
    payload = {"amount_cents": 1800, "category_id": user["category_id"], "spent_on": date.today().isoformat(), "note": "lunch"}

    def send(_):
        # A client per thread: httpx.Client is not shared across threads here.
        with httpx.Client(base_url=server.base_url, timeout=5.0) as client:
            return client.post("/api/transactions", headers=keyed(user, key), json=payload)

    with ThreadPoolExecutor(max_workers=10) as pool:
        responses = list(pool.map(send, range(10)))

    assert all(r.status_code == 201 for r in responses), [r.status_code for r in responses]
    assert len({r.json()["id"] for r in responses}) == 1
    assert sum(r.headers.get("Idempotency-Replayed") == "true" for r in responses) == 9
    with httpx.Client(base_url=server.base_url, timeout=5.0) as client:
        assert count(client, user) == 1


def test_same_key_with_a_different_payload_is_a_conflict(api, make_user):
    user = make_user("keyed-conflict")
    key = f"py-{secrets.token_hex(8)}"
    today = date.today().isoformat()
    first = api.post("/api/transactions", headers=keyed(user, key), json={"amount_cents": 1800, "category_id": user["category_id"], "spent_on": today})
    assert first.status_code == 201, first.text
    second = api.post("/api/transactions", headers=keyed(user, key), json={"amount_cents": 1801, "category_id": user["category_id"], "spent_on": today})
    assert second.status_code == 409, second.text
    assert second.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"
    assert count(api, user) == 1


def test_ai_draft_with_the_feature_off_and_an_oversized_body(api, make_user):
    user = make_user("ai-off")
    draft = api.post(
        "/api/ai/expense-draft",
        headers=auth(user),
        json={"text": "Lunch 9 EUR", "reference_date": date.today().isoformat(), "locale": "auto", "consent_to_external_processing": True},
    )
    assert draft.status_code == 503, draft.text
    assert draft.json()["error"]["code"] == "AI_UNAVAILABLE"

    oversized = api.post(
        "/api/transactions",
        headers={**auth(user), "Content-Type": "application/json"},
        content='{"amount_cents": 1, "note": "' + "x" * (120 * 1024) + '"}',
    )
    assert oversized.status_code == 413, oversized.text
    assert oversized.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"
    assert count(api, user) == 0

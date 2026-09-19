"""Independent API scenarios: parameterized negatives and multi-step state."""

from __future__ import annotations

from datetime import date

import httpx
import pytest

from conftest import Server, auth
from case_link import case


def assert_error(response: httpx.Response, status: int) -> None:
    assert response.status_code == status, response.text
    body = response.json()
    assert response.headers["content-type"].startswith("application/json")
    assert body["error"]["code"] != "INTERNAL"


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"amount_cents": -1},
        {"amount_cents": 0},
        {"amount_cents": 12.5},
        {"amount_cents": "1200"},
        {"amount_cents": True},
        {"amount_cents": 1200, "spent_on": "2026-02-30"},
        {"amount_cents": 1200, "spent_on": {"not": "a date"}},
    ],
    ids=["missing", "negative", "zero", "fractional", "string", "boolean", "impossible-date", "wrong-date-type"],
)
@case("TC-PY-001")
def test_transaction_validation_classes(api, make_user, payload):
    user = make_user("invalid")
    payload = {"category_id": user["category_id"], **payload}
    assert_error(api.post("/api/transactions", headers=auth(user), json=payload), 400)


@case("TC-PY-002")
def test_malformed_json_is_a_json_400(api, make_user):
    user = make_user("malformed")
    response = api.post(
        "/api/transactions",
        headers={**auth(user), "Content-Type": "application/json"},
        content='{"amount_cents":',
    )
    assert_error(response, 400)


@case("TC-PY-003")
def test_protected_route_rejects_missing_malformed_corrupt_and_expired_tokens(api, make_user, server: Server):
    user = make_user("tokens")
    headers = [
        {},
        {"Authorization": "Token not-a-bearer-token"},
        {"Authorization": f"Bearer {user['token']}broken"},
        {"Authorization": f"Bearer {server.expired_token()}"},
    ]
    for request_headers in headers:
        assert_error(api.get("/api/categories", headers=request_headers), 401)


@case("TC-PY-004")
def test_other_user_cannot_view_or_change_a_transaction(api, make_user):
    owner = make_user("owner")
    other = make_user("other")
    created = api.post(
        "/api/transactions",
        headers=auth(owner),
        json={"amount_cents": 1250, "category_id": owner["category_id"], "spent_on": date.today().isoformat()},
    )
    assert created.status_code == 201, created.text
    transaction_id = created.json()["id"]

    listed = api.get("/api/transactions", headers=auth(other))
    assert listed.status_code == 200, listed.text
    assert transaction_id not in [row["id"] for row in listed.json()["items"]]
    assert_error(api.patch(f"/api/transactions/{transaction_id}", headers=auth(other), json={"amount_cents": 1}), 404)
    assert_error(api.delete(f"/api/transactions/{transaction_id}", headers=auth(other)), 404)


@case("TC-PY-005")
def test_expense_lifecycle_create_edit_summary_and_delete(api, make_user):
    user = make_user("lifecycle")
    headers = auth(user)
    assert api.put("/api/settings", headers=headers, json={"monthly_income_cents": 5000}).status_code == 200

    created = api.post(
        "/api/transactions",
        headers=headers,
        json={"amount_cents": 1250, "category_id": user["category_id"], "spent_on": date.today().isoformat()},
    )
    assert created.status_code == 201, created.text
    transaction_id = created.json()["id"]

    edited = api.patch(
        f"/api/transactions/{transaction_id}",
        headers=headers,
        json={"amount_cents": 1750, "note": "edited by pytest"},
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["amount_cents"] == 1750
    assert edited.json()["note"] == "edited by pytest"

    summary = api.get("/api/summary", headers=headers)
    assert summary.status_code == 200, summary.text
    assert summary.json()["total_cents"] == 1750
    assert summary.json()["remaining_cents"] == 3250

    deleted = api.delete(f"/api/transactions/{transaction_id}", headers=headers)
    assert deleted.status_code == 204
    assert api.get("/api/summary", headers=headers).json()["total_cents"] == 0


@case("TC-PY-006")
def test_loan_transitions_from_active_to_finished(api, make_user):
    user = make_user("loan")
    headers = auth(user)
    created = api.post(
        "/api/schedules",
        headers=headers,
        json={
            "name": "pytest loan",
            "amount_cents": 900,
            "category_id": user["category_id"],
            "day_of_month": 1,
            "starts_on": date.today().isoformat(),
            "total_count": 2,
        },
    )
    assert created.status_code == 201, created.text
    schedule_id = created.json()["id"]

    first = api.patch(f"/api/schedules/{schedule_id}/pay", headers=headers)
    assert first.status_code == 200, first.text
    assert first.json()["finished"] is False
    assert first.json()["remaining_count"] == 1

    final = api.patch(f"/api/schedules/{schedule_id}/pay", headers=headers)
    assert final.status_code == 200, final.text
    assert final.json()["finished"] is True
    assert final.json()["remaining_count"] == 0
    assert_error(api.patch(f"/api/schedules/{schedule_id}/pay", headers=headers), 409)

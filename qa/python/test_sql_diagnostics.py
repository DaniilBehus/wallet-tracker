"""The queries in docs/support/sql-diagnostics.md, run as the page shows them.

The SQL is read out of the page itself, so the page and this test cannot drift
apart. It runs on a read-only connection to the session server's own database,
written by the real app through its API, and each query must return exactly
the columns the page lists and agree with the API wherever the API answers the
same question.
"""

from __future__ import annotations

import base64
import json
import re
import secrets
import sqlite3
from datetime import date
from pathlib import Path

import pytest

from conftest import ROOT, Server
from case_link import case


PAGE = ROOT / "docs" / "support" / "sql-diagnostics.md"


def documented_queries() -> dict[str, dict]:
    """Every ```sql block on the page, keyed by its `-- query:` name."""
    queries = {}
    for block in re.findall(r"```sql\n(.*?)```", PAGE.read_text(encoding="utf-8"), flags=re.S):
        meta = dict(re.findall(r"^-- (query|params|returns): (.+)$", block, flags=re.M))
        assert {"query", "params", "returns"} <= set(meta), f"a block lacks its metadata:\n{block}"
        queries[meta["query"].strip()] = {
            "sql": block,
            "params": [p.strip() for p in meta["params"].split(",")],
            "returns": [c.strip() for c in meta["returns"].split(",")],
        }
    return queries


def read_only(db_path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(f"file:{db_path.as_posix()}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    return connection


def run(connection: sqlite3.Connection, name: str, **params) -> list[sqlite3.Row]:
    query = documented_queries()[name]
    cursor = connection.execute(query["sql"], {key: str(value) for key, value in params.items()})
    try:
        columns = [c[0] for c in cursor.description]
        rows = cursor.fetchall()
    finally:
        # Closed before any assertion: a failed one keeps its traceback, and an
        # open cursor in it would hold the database file open on Windows.
        cursor.close()
    assert columns == query["returns"], f"{name}: columns differ from the page"
    return rows


def _user_id(token: str) -> int:
    payload = token.split(".")[1]
    return int(json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))["sub"])


@pytest.fixture(scope="module")
def seeded(api) -> dict:
    """Three accounts the page's questions can be asked about, written through the API."""
    today = date.today().isoformat()

    def register(label: str) -> dict:
        email = f"sql-{label}-{secrets.token_hex(5)}@example.test"
        response = api.post("/api/auth/register", json={"email": email, "password": "correct horse battery"})
        assert response.status_code == 201, response.text
        token = response.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        category = api.get("/api/categories", headers=headers).json()[0]["id"]
        return {"email": email, "headers": headers, "user_id": _user_id(token), "category_id": category}

    spender, blank, zero = register("spender"), register("blank"), register("zero")
    h = spender["headers"]

    for cents in (2500, 1250):
        assert api.post("/api/transactions", headers=h,
                        json={"amount_cents": cents, "category_id": spender["category_id"]}).status_code == 201
    # A month the queries must leave out.
    assert api.post("/api/transactions", headers=h, json={"amount_cents": 999, "category_id": spender["category_id"],
                                                          "spent_on": "2026-01-15"}).status_code == 201
    assert api.put("/api/settings", headers=h,
                   json={"monthly_income_cents": 150000, "monthly_limit_cents": 3000}).status_code == 200
    assert api.put("/api/settings", headers=zero["headers"],
                   json={"monthly_income_cents": 0, "monthly_limit_cents": 0}).status_code == 200

    # A loan paid twice, one of whose payment expenses is then deleted.
    loan = api.post("/api/schedules", headers=h, json={"name": "Laptop", "amount_cents": 1000, "day_of_month": 5,
                                                       "starts_on": "2026-01-01", "total_count": 3}).json()
    first = api.patch(f"/api/schedules/{loan['id']}/pay", headers=h).json()["transaction_id"]
    api.patch(f"/api/schedules/{loan['id']}/pay", headers=h)
    assert api.delete(f"/api/transactions/{first}", headers=h).status_code == 204

    # One keyed save retried once, and one whose expense is deleted afterwards.
    live_key, gone_key = f"live-{secrets.token_hex(6)}", f"gone-{secrets.token_hex(6)}"
    body = {"amount_cents": 400, "category_id": spender["category_id"], "spent_on": today}
    saved = api.post("/api/transactions", headers={**h, "Idempotency-Key": live_key}, json=body)
    replay = api.post("/api/transactions", headers={**h, "Idempotency-Key": live_key}, json=body)
    assert replay.headers.get("idempotency-replayed") == "true"
    gone = api.post("/api/transactions", headers={**h, "Idempotency-Key": gone_key}, json={**body, "amount_cents": 300})
    assert api.delete(f"/api/transactions/{gone.json()['id']}", headers=h).status_code == 204

    return {"spender": spender, "blank": blank, "zero": zero, "today": today, "month": today[:7], "loan": loan,
            "live_key": live_key, "live_tx": saved.json()["id"], "gone_key": gone_key}


@case("TC-PY-014")
def test_every_documented_query_is_read_only_and_returns_its_columns(server: Server, seeded):
    queries = documented_queries()
    assert set(queries) == {"user-id", "month-total", "limit-state", "schedule-payments", "keyed-saves", "ai-quota-today"}
    values = {"email": seeded["spender"]["email"], "user_id": seeded["spender"]["user_id"],
              "month": seeded["month"], "day": seeded["today"]}

    connection = read_only(server.db_path)
    try:
        # The connection itself refuses writes, so whatever a query did, it
        # could not have changed anything.
        with pytest.raises(sqlite3.OperationalError, match="readonly"):
            connection.execute("CREATE TABLE should_not_exist (x)")
        for name, query in queries.items():
            body = "\n".join(l for l in query["sql"].splitlines() if not l.startswith("--")).strip()
            assert re.match(r"^(SELECT|WITH)\b", body, flags=re.I), f"{name} is not a SELECT"
            assert body.count(";") == 1 and body.endswith(";"), f"{name} must be one statement"
            used = sorted(set(re.findall(r":([a-z_]+)", body)))
            assert used == sorted(query["params"]), f"{name}: placeholders {used} vs documented {query['params']}"
            run(connection, name, **{p: values[p] for p in query["params"]})
    finally:
        connection.close()


@case("TC-PY-015")
def test_the_month_and_limit_queries_agree_with_the_summary(api, server: Server, seeded):
    connection = read_only(server.db_path)
    try:
        spender = seeded["spender"]
        # Typed the way a person would give it: capitals, stray spaces.
        found = run(connection, "user-id", email=f"  {spender['email'].upper()} ")
        assert [row["user_id"] for row in found] == [spender["user_id"]]

        for who in ("spender", "blank", "zero"):
            account = seeded[who]
            summary = api.get(f"/api/summary?month={seeded['month']}", headers=account["headers"]).json()
            [total] = run(connection, "month-total", user_id=account["user_id"], month=seeded["month"])
            assert total["total_cents"] == summary["total_cents"], who
            [state] = run(connection, "limit-state", user_id=account["user_id"], month=seeded["month"])
            assert state["limit_status"] == summary["limit_status"], who
            assert state["limit_cents"] == summary["limit_cents"], who

        # The three look-alikes the page's table tells apart.
        states = {who: run(connection, "limit-state", user_id=seeded[who]["user_id"], month=seeded["month"])[0]
                  for who in ("spender", "blank", "zero")}
        assert (states["spender"]["settings_row"], states["spender"]["limit_status"]) == (1, "exceeded")
        assert (states["blank"]["settings_row"], states["blank"]["limit_cents"], states["blank"]["limit_status"]) == (0, None, "not_set")
        assert (states["zero"]["limit_cents"], states["zero"]["limit_status"]) == (0, "reached")
    finally:
        connection.close()


@case("TC-PY-016")
def test_payments_keys_and_quota_mean_what_the_page_says(server: Server, seeded):
    connection = read_only(server.db_path)
    try:
        user_id = seeded["spender"]["user_id"]
        [loan] = run(connection, "schedule-payments", user_id=user_id)
        assert loan["schedule_id"] == seeded["loan"]["id"]
        assert (loan["total_count"], loan["paid_count"], loan["active"]) == (3, 2, 1)
        # Two presses of Pay, one expense deleted afterwards: explained, not broken.
        assert (loan["linked_expenses"], loan["unlinked_payments"]) == (1, 1)

        keys = {row["operation_key"]: row for row in run(connection, "keyed-saves", user_id=user_id)}
        assert set(keys) == {seeded["live_key"], seeded["gone_key"]}, "a retry adds no row"
        assert keys[seeded["live_key"]]["state"] == "live"
        assert keys[seeded["live_key"]]["transaction_id"] == seeded["live_tx"]
        assert keys[seeded["gone_key"]]["state"] == "tombstone"

        # AI is off on this server, so nothing is ever counted.
        assert run(connection, "ai-quota-today", user_id=user_id, day=seeded["today"]) == []
    finally:
        connection.close()

"""Request ids and the request log, checked against a real server's output.

The session server in conftest.py runs with the request log off, because its
stdout is a pipe nobody reads. These scenarios start their own server with the
log on and its output written to files, so every line it prints can be read
back and held to what docs/support promises about it.
"""

from __future__ import annotations

import base64
import json
import os
import re
import secrets
import sqlite3
import subprocess
import tempfile
import time
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Callable

import httpx
import pytest

from conftest import HEALTH_TIMEOUT_SECONDS, ROOT, _free_port
from case_link import case


UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
REQUEST_FIELDS = {"time", "level", "event", "request_id", "method", "route", "status", "duration_ms", "user_id"}


@dataclass
class LoggedServer:
    base_url: str
    db_path: Path
    stdout: Path
    stderr: Path

    def lines(self, stream: str = "stdout") -> list[dict]:
        """Every JSON line the server has written to one stream so far."""
        text = (self.stdout if stream == "stdout" else self.stderr).read_text(encoding="utf-8")
        found = []
        for raw in text.splitlines():
            raw = raw.strip()
            if raw.startswith("{"):
                found.append(json.loads(raw))
        return found

    def request_line(self, request_id: str) -> dict:
        """The one request line for an id, waiting briefly: it is written on close."""
        deadline = time.monotonic() + 3
        while True:
            matches = [l for l in self.lines() if l.get("event") == "request" and l.get("request_id") == request_id]
            if matches or time.monotonic() > deadline:
                break
            time.sleep(0.05)
        assert len(matches) == 1, f"expected one request line for {request_id}, found {len(matches)}"
        return matches[0]

    def everything(self) -> str:
        return self.stdout.read_text(encoding="utf-8") + self.stderr.read_text(encoding="utf-8")


def _start(temp_dir: str, request_log: str | None) -> tuple[subprocess.Popen, LoggedServer, list]:
    port = _free_port()
    folder = Path(temp_dir)
    env = {key: value for key, value in os.environ.items() if key != "WALLET_REQUEST_LOG"}
    env.update({
        "PORT": str(port),
        "DB_PATH": str(folder / "wallet.db"),
        "JWT_SECRET": secrets.token_hex(48),
        "WALLET_AI_MODE": "off",
        "PYTHONUTF8": "1",
    })
    if request_log is not None:
        env["WALLET_REQUEST_LOG"] = request_log
    # Files, not pipes: a pipe nobody reads fills up and stalls the server.
    out = open(folder / "stdout.log", "w", encoding="utf-8")
    err = open(folder / "stderr.log", "w", encoding="utf-8")
    process = subprocess.Popen(["node", str(ROOT / "src" / "server.js")], cwd=ROOT, env=env, stdout=out, stderr=err)
    server = LoggedServer(f"http://127.0.0.1:{port}", folder / "wallet.db", folder / "stdout.log", folder / "stderr.log")

    deadline = time.monotonic() + HEALTH_TIMEOUT_SECONDS
    while True:
        if process.poll() is not None:
            pytest.fail(f"server exited before it was healthy: {server.everything()}")
        try:
            if httpx.get(f"{server.base_url}/api/health", timeout=1.0).status_code == 200:
                break
        except httpx.HTTPError:
            pass
        if time.monotonic() > deadline:
            process.kill()
            pytest.fail("server never became healthy")
        time.sleep(0.1)
    return process, server, [out, err]


def _stop(process: subprocess.Popen, handles: list) -> None:
    if process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
    for handle in handles:
        handle.close()


@pytest.fixture(scope="module")
def logged():
    with tempfile.TemporaryDirectory(prefix="wallet-log-") as temp_dir:
        process, server, handles = _start(temp_dir, request_log=None)
        try:
            yield server
        finally:
            _stop(process, handles)


@pytest.fixture(scope="module")
def client(logged: LoggedServer):
    # Long enough for the busy-timeout case, which waits out 5 s on purpose.
    with httpx.Client(base_url=logged.base_url, timeout=20.0) as http:
        yield http


@pytest.fixture(scope="module")
def account(client: httpx.Client) -> dict:
    email = f"log-{secrets.token_hex(6)}@example.test"
    password = f"pw-{secrets.token_hex(8)}"
    response = client.post("/api/auth/register", json={"email": email, "password": password})
    assert response.status_code == 201, response.text
    token = response.json()["token"]
    payload = token.split(".")[1]
    user_id = int(json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))["sub"])
    categories = client.get("/api/categories", headers={"Authorization": f"Bearer {token}"}).json()
    return {"email": email, "password": password, "token": token, "user_id": user_id,
            "category_id": categories[0]["id"], "headers": {"Authorization": f"Bearer {token}"}}


def _draft(text: str) -> dict:
    return {"text": text, "reference_date": date.today().isoformat(), "locale": "auto",
            "consent_to_external_processing": True}


def _assert_error_body(response: httpx.Response) -> None:
    # spec §5: the error body is exactly this shape; the id lives in the header.
    body = response.json()
    assert set(body) == {"error"}, body
    assert set(body["error"]) == {"code", "message"}, body


@case("TC-PY-007")
def test_every_response_carries_a_request_id(client, account):
    responses: dict[str, Callable[[], httpx.Response]] = {
        "200 health": lambda: client.get("/api/health"),
        "200 authenticated read": lambda: client.get("/api/categories", headers=account["headers"]),
        "400 malformed JSON": lambda: client.post("/api/transactions", headers={**account["headers"], "content-type": "application/json"}, content=b"{not json"),
        "401 no token": lambda: client.get("/api/transactions"),
        "404 unknown endpoint": lambda: client.get("/api/nowhere"),
        "503 AI switched off": lambda: client.post("/api/ai/expense-draft", headers=account["headers"], json=_draft("bread 3")),
    }
    seen = set()
    for label, send in responses.items():
        response = send()
        assert response.status_code == int(label.split()[0]), f"{label}: {response.status_code}"
        request_id = response.headers.get("x-request-id")
        assert request_id and UUID.match(request_id), f"{label}: {request_id!r}"
        seen.add(request_id)
        if response.status_code >= 400:
            _assert_error_body(response)
    assert len(seen) == len(responses), "every request gets an id of its own"


@case("TC-PY-008")
def test_a_callers_id_is_kept_only_when_it_is_a_uuid(client, logged):
    own = "0f1e2d3c-4b5a-4968-8778-695a4b3c2d1e"
    echoed = client.get("/api/health", headers={"X-Request-Id": own})
    assert echoed.headers["x-request-id"] == own

    unsafe = [
        "short-id",                              # too short (and not hex, so it
                                                 # cannot turn up inside a UUID)
        "a" * 65,                                # too long
        own.upper(),                             # right shape, wrong case
        own + "0",                               # one character too many
        "0f1e2d3c 4b5a 4968 8778 695a4b3c2d1e",  # spaces
        "<script>alert(1)</script>-0000-000",    # markup
        "id\",\"level\":\"forged",               # an attempt to break the JSON line
    ]
    for value in unsafe:
        response = client.get("/api/health", headers={"X-Request-Id": value})
        replaced = response.headers["x-request-id"]
        assert replaced != value and UUID.match(replaced), f"{value!r} was not replaced: {replaced!r}"
        logged.request_line(replaced)
    log = logged.everything()
    for value in unsafe:
        assert value not in log, f"a refused id reached the log: {value!r}"


@case("TC-PY-009")
def test_one_line_per_request_names_the_route_not_the_url(client, logged, account):
    created = client.post("/api/transactions", headers=account["headers"],
                          json={"amount_cents": 1234, "category_id": account["category_id"]})
    assert created.status_code == 201, created.text
    tx_id = created.json()["id"]

    edit = client.patch(f"/api/transactions/{tx_id}", headers=account["headers"], json={"amount_cents": 1300})
    listing = client.get("/api/transactions?from=2026-01-01&to=2099-12-31", headers=account["headers"])
    refused = client.get(f"/api/transactions/{tx_id}")          # no token: refused before any route
    unknown = client.get("/api/nowhere/42")

    expected = [
        (created, "POST", "/api/transactions", 201, account["user_id"]),
        (edit, "PATCH", "/api/transactions/:id", 200, account["user_id"]),
        (listing, "GET", "/api/transactions", 200, account["user_id"]),
        (refused, "GET", "/api/transactions/*", 401, None),
        (unknown, "GET", None, 404, None),
    ]
    for response, method, route, status, user_id in expected:
        line = logged.request_line(response.headers["x-request-id"])
        assert REQUEST_FIELDS <= set(line), f"missing fields: {REQUEST_FIELDS - set(line)}"
        assert line["level"] == "info" and line["event"] == "request"
        assert line["method"] == method
        assert line["route"] == route, line
        assert line["status"] == status == response.status_code
        assert line["user_id"] == user_id
        assert isinstance(line["duration_ms"], (int, float)) and line["duration_ms"] >= 0
        assert re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$", line["time"])
        # The pattern, never the address: no row id, no query string.
        assert str(tx_id) not in json.dumps(line["route"]) and "?" not in json.dumps(line)


@case("TC-PY-010")
def test_no_credential_or_content_reaches_the_log(client, logged):
    email = f"private-{secrets.token_hex(6)}@example.test"
    password = f"never-log-me-{secrets.token_hex(6)}"
    note = f"note-{secrets.token_hex(6)} for the pharmacy"
    description = f"describe-{secrets.token_hex(6)} coffee 3 eur"

    registered = client.post("/api/auth/register", json={"email": email, "password": password})
    assert registered.status_code == 201
    signed_in = client.post("/api/auth/login", json={"email": email, "password": password})
    assert signed_in.status_code == 200
    token = signed_in.json()["token"]
    wrong = client.post("/api/auth/login", json={"email": email, "password": password + "x"})
    assert wrong.status_code == 401
    headers = {"Authorization": f"Bearer {token}"}
    category = client.get("/api/categories", headers=headers).json()[0]["id"]
    saved = client.post("/api/transactions", headers=headers,
                        json={"amount_cents": 500, "category_id": category, "note": note})
    assert saved.status_code == 201
    drafted = client.post("/api/ai/expense-draft", headers=headers, json=_draft(description))
    assert drafted.status_code == 503

    for response in (registered, signed_in, wrong, saved, drafted):
        logged.request_line(response.headers["x-request-id"])
    log = logged.everything()
    for secret in (email, password, password + "x", token, registered.json()["token"], note, description):
        assert secret not in log, f"leaked into the log: {secret[:24]}"
    assert "Bearer" not in log and "authorization" not in log.lower()


@case("TC-PY-011")
def test_an_unhandled_error_is_logged_with_its_request_id(client, logged, account):
    # Another connection holds the write lock, as a second program or a stuck
    # backup would. The insert waits out busy_timeout (5 s) and fails with
    # SQLITE_BUSY — an error the app does not map, so it takes the 500 path.
    blocker = sqlite3.connect(str(logged.db_path), isolation_level=None, timeout=1)
    try:
        blocker.execute("BEGIN IMMEDIATE")
        response = client.post("/api/transactions", headers=account["headers"],
                               json={"amount_cents": 700, "category_id": account["category_id"]})
    finally:
        blocker.execute("ROLLBACK")
        blocker.close()

    assert response.status_code == 500, response.text
    assert response.json() == {"error": {"code": "INTERNAL", "message": "Unexpected server error"}}
    request_id = response.headers["x-request-id"]
    assert UUID.match(request_id)

    deadline = time.monotonic() + 3
    while True:
        errors = [l for l in logged.lines("stderr") if l.get("event") == "UNHANDLED" and l.get("request_id") == request_id]
        if errors or time.monotonic() > deadline:
            break
        time.sleep(0.05)
    assert len(errors) == 1, "the unhandled error is logged once, under the request's id"
    error = errors[0]
    assert error["level"] == "error" and error["route"] == "/api/transactions"
    assert error["code"] == "SQLITE_BUSY"
    assert error["stack"] and "at " in error["stack"]
    assert logged.request_line(request_id)["status"] == 500


@case("TC-PY-012")
def test_the_ai_draft_line_carries_the_same_id(client, logged, account):
    response = client.post("/api/ai/expense-draft", headers=account["headers"], json=_draft("milk 2 eur"))
    assert response.status_code == 503
    request_id = response.headers["x-request-id"]
    deadline = time.monotonic() + 3
    while True:
        drafts = [l for l in logged.lines() if l.get("event") == "ai_draft" and l.get("request_id") == request_id]
        if drafts or time.monotonic() > deadline:
            break
        time.sleep(0.05)
    assert len(drafts) == 1, "the draft's own log line uses the request id"
    assert drafts[0]["outcome"] == "AI_UNAVAILABLE"
    assert logged.request_line(request_id)["route"] == "/api/ai/expense-draft"


@case("TC-PY-013")
def test_the_switch_silences_request_lines_but_keeps_the_id():
    with tempfile.TemporaryDirectory(prefix="wallet-quiet-") as temp_dir:
        process, server, handles = _start(temp_dir, request_log="off")
        try:
            with httpx.Client(base_url=server.base_url, timeout=5.0) as http:
                ids = [http.get("/api/health").headers.get("x-request-id") for _ in range(3)]
                ids.append(http.get("/api/nowhere").headers.get("x-request-id"))
            time.sleep(0.3)
            assert all(i and UUID.match(i) for i in ids), ids
            assert [l for l in server.lines() if l.get("event") == "request"] == []
        finally:
            _stop(process, handles)

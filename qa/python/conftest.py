"""Fixtures for the Python API layer; every run owns its process and data."""

from __future__ import annotations

import base64
import hashlib
import hmac
import itertools
import json
import os
import secrets
import socket
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path

import httpx
import pytest


ROOT = Path(__file__).resolve().parents[2]
HEALTH_TIMEOUT_SECONDS = 30


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def _jwt_part(value: dict[str, object]) -> bytes:
    raw = json.dumps(value, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).rstrip(b"=")


@dataclass(frozen=True)
class Server:
    base_url: str
    secret: str

    def expired_token(self, user_id: int = 1) -> str:
        """Create a valid HS256 token whose only invalid property is its age."""
        issued = int(time.time()) - 60 * 60 * 24 * 40
        unsigned = b".".join(
            [
                _jwt_part({"alg": "HS256", "typ": "JWT"}),
                _jwt_part({"sub": str(user_id), "iat": issued, "exp": issued + 60 * 60 * 24 * 30}),
            ]
        )
        signature = hmac.new(self.secret.encode("utf-8"), unsigned, hashlib.sha256).digest()
        return b".".join([unsigned, base64.urlsafe_b64encode(signature).rstrip(b"=")]).decode("ascii")


@pytest.fixture(scope="session")
def server() -> Server:
    """Start the real Express app and cleanly stop it after the test session."""
    secret = secrets.token_hex(48)
    port = _free_port()
    base_url = f"http://127.0.0.1:{port}"

    with tempfile.TemporaryDirectory(prefix="wallet-pytest-") as temp_dir:
        env = {
            **os.environ,
            "PORT": str(port),
            "DB_PATH": str(Path(temp_dir) / "wallet.db"),
            "JWT_SECRET": secret,
            "LOGIN_WINDOW_MS": "1000",
            "PYTHONUTF8": "1",
        }
        process = subprocess.Popen(
            ["node", str(ROOT / "src" / "server.js")],
            cwd=ROOT,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        client = httpx.Client(timeout=1.0)
        deadline = time.monotonic() + HEALTH_TIMEOUT_SECONDS

        try:
            last_error = "no health request completed"
            while time.monotonic() < deadline:
                if process.poll() is not None:
                    _, stderr = process.communicate()
                    pytest.fail(f"Express server exited before health check: {stderr.strip()}")
                try:
                    response = client.get(f"{base_url}/api/health")
                    if response.status_code == 200 and response.json().get("db") == "ok":
                        break
                    last_error = f"HTTP {response.status_code}"
                except httpx.HTTPError as exc:
                    last_error = str(exc)
                time.sleep(0.1)
            else:
                pytest.fail(f"Express server did not become healthy: {last_error}")

            yield Server(base_url=base_url, secret=secret)
        finally:
            client.close()
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)


@pytest.fixture(scope="session")
def api(server: Server) -> httpx.Client:
    with httpx.Client(base_url=server.base_url, timeout=5.0) as client:
        yield client


@pytest.fixture
def make_user(api: httpx.Client):
    counter = itertools.count()

    def create(label: str = "user") -> dict[str, object]:
        email = f"pytest-{label}-{next(counter)}-{secrets.token_hex(4)}@example.test"
        response = api.post("/api/auth/register", json={"email": email, "password": "correct horse battery"})
        assert response.status_code == 201, response.text
        token = response.json()["token"]
        categories = api.get("/api/categories", headers={"Authorization": f"Bearer {token}"})
        assert categories.status_code == 200, categories.text
        return {"token": token, "category_id": categories.json()[0]["id"]}

    return create


def auth(user: dict[str, object]) -> dict[str, str]:
    return {"Authorization": f"Bearer {user['token']}"}

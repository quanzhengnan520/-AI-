"""Real loopback Uvicorn smoke test with isolated synthetic data and credentials."""

from __future__ import annotations

import hashlib
import json
import os
import secrets
import socket
import subprocess
import sys
import tempfile
import time
from contextlib import contextmanager
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import UUID


@contextmanager
def temporary_database():
    temporary = tempfile.TemporaryDirectory(prefix="secondbrain-m0-smoke-")
    try:
        yield temporary.name
    finally:
        # Windows may briefly retain SQLite file handles after process exit.
        for attempt in range(10):
            try:
                temporary.cleanup()
                break
            except PermissionError:
                if attempt == 9:
                    raise
                time.sleep(0.2)


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    api = root / "services" / "api"
    artifacts = root / ".artifacts" / "verification"
    artifacts.mkdir(parents=True, exist_ok=True)
    results: list[str] = []

    with temporary_database() as temporary:
        temporary_path = Path(temporary).resolve()
        assert temporary_path.is_relative_to(Path(tempfile.gettempdir()).resolve())
        environment = dict(os.environ)
        token = secrets.token_urlsafe(32)
        environment.update(
            APP_ENV="test",
            DATABASE_URL=f"sqlite:///{(temporary_path / 'smoke.db').as_posix()}",
            MOCK_MODE="true",
            LIVE_AI_ENABLED="false",
            LLM_PROVIDER="mock",
            ASR_PROVIDER="mock",
            DEVICE_TOKEN_SHA256=hashlib.sha256(token.encode()).hexdigest(),
        )
        with (artifacts / "api-smoke-server.log").open("w", encoding="utf-8") as log:
            subprocess.run(
                [sys.executable, "-m", "alembic", "upgrade", "head"],
                cwd=api,
                env=environment,
                stdout=log,
                stderr=log,
                check=True,
            )
            with socket.socket() as probe:
                probe.bind(("127.0.0.1", 0))
                port = probe.getsockname()[1]
            process = subprocess.Popen(
                [
                    sys.executable,
                    "-m",
                    "uvicorn",
                    "app.main:app",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    str(port),
                    "--no-access-log",
                ],
                cwd=api,
                env=environment,
                stdout=log,
                stderr=log,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
            base = f"http://127.0.0.1:{port}"

            def request(path: str, status: int, authorized: bool = False) -> dict:
                headers = {"Authorization": f"Bearer {token}"} if authorized else {}
                try:
                    response = urlopen(Request(base + path, headers=headers), timeout=3)
                except HTTPError as error:
                    response = error
                with response:
                    assert response.status == status, f"{path}: unexpected status {response.status}"
                    body = json.load(response)
                    UUID(body["request_id"])
                    assert response.headers["X-Request-ID"] == body["request_id"]
                    assert ("data" if status == 200 else "error") in body
                    return body

            try:
                deadline = time.monotonic() + 20
                while True:
                    if process.poll() is not None:
                        raise RuntimeError("Uvicorn exited; inspect api-smoke-server.log")
                    try:
                        health = request("/health", 200)
                        break
                    except (URLError, TimeoutError):
                        if time.monotonic() >= deadline:
                            raise RuntimeError("Uvicorn startup deadline exceeded") from None
                        time.sleep(0.2)
                assert health["data"]["status"] == "ok"
                assert health["data"]["database"] == "ok"
                results.append("PASS: migrated SQLite health over real loopback HTTP")
                meta = request("/api/v1/meta", 200)["data"]
                assert meta["mode"] == "mock" and meta["live_ai_enabled"] is False
                results.append("PASS: metadata declares Mock with Live disabled")
                request("/api/v1/demo", 401)
                results.append("PASS: missing token rejected with structured 401")
                demo = request("/api/v1/demo?limit=1", 200, True)["data"]
                assert demo["mock"] is True and len(demo["records"]) == 1
                results.append("PASS: random token authorizes labelled synthetic resource")
                request("/api/v1/demo?limit=0", 422, True)
                results.append("PASS: invalid query returns structured 422")
                request("/api/v1/does-not-exist", 404)
                results.append("PASS: unknown route returns structured 404")
            finally:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)

    summary = "\n".join(results) + f"\n{len(results)} real-process checks passed.\n"
    (artifacts / "api-smoke.txt").write_text(summary, encoding="utf-8")
    print(summary, end="")


if __name__ == "__main__":
    main()

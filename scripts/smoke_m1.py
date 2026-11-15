"""M1 real HTTP and process-restart acceptance. All data and credentials are synthetic."""

from __future__ import annotations

import hashlib
import json
import os
import secrets
import socket
import sqlite3
import subprocess
import sys
import time
from contextlib import closing
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from uuid import UUID, uuid4

from smoke_api import temporary_database


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    api = root / "services" / "api"
    artifacts = root / ".artifacts" / "verification" / "m1"
    artifacts.mkdir(parents=True, exist_ok=True)
    fixture = json.loads((root / "fixtures/m1_budget_story.json").read_text(encoding="utf-8"))
    results: list[str] = []

    def passed(message: str) -> None:
        results.append("PASS: " + message)
        print(results[-1], flush=True)

    with temporary_database() as directory:
        temporary = Path(directory)
        database = temporary / "acceptance.db"
        code_file = temporary / "code.txt"
        legacy_token = secrets.token_urlsafe(32)
        environment = dict(os.environ)
        environment.update(
            APP_ENV="test",
            DATABASE_URL=f"sqlite:///{database.as_posix()}",
            MOCK_MODE="true",
            LIVE_AI_ENABLED="false",
            LLM_PROVIDER="mock",
            ASR_PROVIDER="mock",
            DEVICE_TOKEN_SHA256=hashlib.sha256(legacy_token.encode()).hexdigest(),
        )
        with (artifacts / "http-server.log").open("w", encoding="utf-8") as log:

            def operator(*arguments: str) -> None:
                subprocess.run(
                    [sys.executable, "-m", *arguments],
                    cwd=api,
                    env=environment,
                    stdout=log,
                    stderr=log,
                    check=True,
                )

            operator("alembic", "upgrade", "0001_m0")
            with closing(sqlite3.connect(database)) as connection, connection:
                assert (
                    connection.execute("SELECT milestone FROM schema_state").fetchone()[0] == "M0"
                )
            operator("alembic", "upgrade", "head")
            passed("M0 database upgrades additively to M1")
            operator("app.manage", "pairing-code", "--output", str(code_file))
            code = code_file.read_text(encoding="utf-8").strip()
            with socket.socket() as probe:
                probe.bind(("127.0.0.1", 0))
                port = probe.getsockname()[1]
            base = f"http://127.0.0.1:{port}"
            token = ""
            process: subprocess.Popen | None = None

            def request(
                path: str,
                method: str = "GET",
                payload: dict | None = None,
                statuses: tuple[int, ...] = (200,),
                authorized: bool = True,
                key: str | None = None,
            ) -> dict:
                headers = {"Accept": "application/json"}
                if authorized and token:
                    headers["Authorization"] = f"Bearer {token}"
                if key:
                    headers["Idempotency-Key"] = key
                data = None
                if payload is not None:
                    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
                    headers["Content-Type"] = "application/json"
                try:
                    response = urlopen(
                        Request(base + path, data=data, headers=headers, method=method), timeout=8
                    )
                except HTTPError as error:
                    response = error
                with response:
                    assert response.status in statuses, (
                        f"{method} {path}: unexpected status {response.status}"
                    )
                    body = json.load(response)
                    UUID(body["request_id"])
                    assert response.headers["X-Request-ID"] == body["request_id"]
                    assert ("data" if response.status < 300 else "error") in body
                    return body

            def start() -> None:
                nonlocal process
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
                deadline = time.monotonic() + 20
                while True:
                    assert process.poll() is None, (
                        "Uvicorn exited before ready; inspect http-server.log"
                    )
                    try:
                        assert request("/health", authorized=False)["data"]["status"] == "ok"
                        return
                    except (URLError, TimeoutError):
                        if time.monotonic() >= deadline:
                            raise RuntimeError("M1 server startup timeout") from None
                        time.sleep(0.2)

            def stop() -> None:
                nonlocal process
                if process is not None:
                    process.terminate()
                    try:
                        process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait(timeout=5)
                    process = None
                    time.sleep(0.2)

            try:
                start()
                request("/api/v1/records", statuses=(401,), authorized=False)
                paired = request(
                    "/api/v1/auth/devices/pair",
                    "POST",
                    {"pairing_code": code, "name": "M1 synthetic acceptance", "platform": "web"},
                    statuses=(200, 201),
                    authorized=False,
                )["data"]
                token = paired["device_token"]
                device_id = paired["device_id"]
                request(
                    "/api/v1/auth/devices/pair",
                    "POST",
                    {"pairing_code": code, "name": "replay", "platform": "web"},
                    statuses=(401, 409),
                    authorized=False,
                )
                passed("business endpoints require pairing and pairing code cannot be reused")
                records: list[dict] = []
                keys: list[str] = []
                for payload in fixture["records"]:
                    key = str(uuid4())
                    record = request("/api/v1/records", "POST", payload, (200, 201), key=key)[
                        "data"
                    ]
                    replay = request("/api/v1/records", "POST", payload, (200, 201), key=key)[
                        "data"
                    ]
                    assert record["id"] == replay["id"]
                    assert record["body_text"] == payload["body_text"]
                    assert record["people"] == ["王总"] and record["projects"] == ["星河示例项目"]
                    records.append(record)
                    keys.append(key)
                request(
                    "/api/v1/records",
                    "POST",
                    {**fixture["records"][0], "body_text": "不同的虚构内容"},
                    (409,),
                    key=keys[0],
                )
                passed(
                    "three originals persist with shared associations; retries create no duplicates"
                )
                listing = request(
                    "/api/v1/records?" + urlencode({"q": "预算", "project": "星河示例项目"})
                )["data"]
                assert len(listing["items"]) >= 2
                all_items = request("/api/v1/records")["data"]["items"]
                assert [item["id"] for item in all_items] == [
                    record["id"] for record in reversed(records)
                ]
                passed("keyword filtering and UTC timeline preserve all three dates")
                facts: list[dict] = []
                for record in records:
                    extraction = request(f"/api/v1/records/{record['id']}/extract", "POST", {})[
                        "data"
                    ]
                    assert extraction["provider"] == "mock" and extraction["items"]
                    for fact in extraction["items"]:
                        anchor = fact["evidence_anchor"]
                        assert (
                            record["body_text"][anchor["start_char"] : anchor["end_char"]]
                            == anchor["quote"]
                        )
                        assert fact["status"] == "candidate" and fact["source_record_version"] == 1
                    facts.append(extraction["items"][0])
                passed("Mock extraction creates unverified candidates with exact source anchors")
                answer = request(
                    "/api/v1/queries",
                    "POST",
                    {
                        "question": fixture["questions"]["budget"],
                        "filters": {"entity_names": ["王总", "星河示例项目"]},
                        "include_uncertainty": True,
                    },
                )["data"]
                assert {citation["record_id"] for citation in answer["citations"]} == {
                    record["id"] for record in records
                }
                originals = {record["id"]: record["body_text"] for record in records}
                for citation in answer["citations"]:
                    assert (
                        originals[citation["record_id"]][
                            citation["start_char"] : citation["end_char"]
                        ]
                        == citation["quote"]
                    )
                assert any(
                    word in answer["answer"]
                    for word in ["无法确认", "不能确认", "不能证明", "不足以确认"]
                )
                passed("budget answer cites all three originals and does not establish approval")
                refused = request(
                    "/api/v1/queries", "POST", {"question": fixture["questions"]["unrelated"]}
                )["data"]
                assert (
                    refused["certainty"] == "insufficient_evidence" and refused["citations"] == []
                )
                passed("unrelated question refuses without invented citations")
                first = facts[0]
                verified = request(
                    f"/api/v1/memories/{first['id']}",
                    "PATCH",
                    {"expected_version": first["version"], "review_action": "verify"},
                )["data"]
                assert verified["status"] == "verified_by_user"
                request(
                    f"/api/v1/memories/{first['id']}",
                    "PATCH",
                    {"expected_version": first["version"], "review_action": "reject"},
                    (409,),
                )
                third = facts[2]
                corrected = request(
                    f"/api/v1/memories/{third['id']}",
                    "PATCH",
                    {
                        "expected_version": third["version"],
                        "review_action": "correct",
                        "corrected_object_text": "目前口头考虑150万元，仍需核实",
                    },
                )["data"]
                assert corrected["status"] in ["candidate", "needs_review"]
                rejected = request(
                    f"/api/v1/memories/{facts[1]['id']}",
                    "PATCH",
                    {"expected_version": facts[1]["version"], "review_action": "reject"},
                )["data"]
                assert rejected["status"] == "rejected"
                passed("verify/reject/correction and version conflicts preserve trust distinctions")
                extra = {
                    **fixture["records"][0],
                    "title": "待修订合成样本",
                    "body_text": "😀会议原文：下次日期尚未确认。",
                }
                extra_key = str(uuid4())
                created = request("/api/v1/records", "POST", extra, (200, 201), key=extra_key)[
                    "data"
                ]
                edited = request(
                    f"/api/v1/records/{created['id']}",
                    "PATCH",
                    {"expected_version": 1, "body_text": "😀会议修订：会议暂定下周举行。"},
                )["data"]
                request(
                    f"/api/v1/records/{created['id']}",
                    "PATCH",
                    {"expected_version": 1, "title": "过时编辑"},
                    (409,),
                )
                history = request(f"/api/v1/records/{created['id']}?version=1")["data"]
                assert history["body_text"] == extra["body_text"] and edited["version"] == 2
                passed("editing preserves the original version and rejects stale writes")
                request(
                    f"/api/v1/records/{created['id']}?expected_version=2&confirm=true", "DELETE"
                )
                request(f"/api/v1/records/{created['id']}", statuses=(404, 410))
                request("/api/v1/records", "POST", extra, (409, 410), key=extra_key)
                assert len(request("/api/v1/records")["data"]["items"]) == 3
                passed("explicit delete removes access and idempotent replay cannot resurrect it")
                stop()
                start()
                persisted = request("/api/v1/records")["data"]["items"]
                assert {item["id"] for item in persisted} == {record["id"] for record in records}
                assert (
                    request(f"/api/v1/memories/{first['id']}")["data"]["status"]
                    == "verified_by_user"
                )
                passed("records, device authentication and reviewed memory survive server restart")
                with closing(sqlite3.connect(database)) as connection, connection:
                    connection.execute(
                        "UPDATE devices SET revoked_at=? WHERE id=?",
                        ("2026-11-15T00:00:00Z", device_id),
                    )
                request("/api/v1/records", statuses=(401,))
                passed("revoked device token is rejected")
            finally:
                stop()

    summary = (
        "\n".join(results)
        + f"\n{len(results)} M1 real-process checks passed. Synthetic data only.\n"
    )
    (artifacts / "http-smoke.txt").write_text(summary, encoding="utf-8")


if __name__ == "__main__":
    main()

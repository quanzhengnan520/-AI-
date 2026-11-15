"""M1 integration boundaries with fictional text, local SQLite and fake providers."""

from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import digest, issue_pairing_code
from app.config import Settings
from app.database import Base, SchemaState
from app.main import create_app
from app.models import OWNER_ID, Device, MemoryFact, ModelUsage, PairingCode, SourceRecord, User
from app.providers.base import ProviderUnavailable
from app.providers.memory import MockMemoryProvider

BODY = {
    "kind": "text",
    "title": "虚构项目沟通",
    "body_text": "  🧪王总表示项目预算预计为200万元。\n",
    "captured_at": "2026-10-01T06:00:00Z",
    "timezone": "Asia/Shanghai",
    "consent_confirmed": True,
    "people": ["王总"],
    "projects": ["星河示例项目"],
    "events": ["预算沟通"],
}


@pytest.fixture
def m1_client(tmp_path: Path) -> Iterator[tuple[TestClient, Settings, dict[str, str]]]:
    settings = Settings(
        _env_file=None,
        app_env="test",
        database_url=f"sqlite:///{(tmp_path / 'synthetic.db').as_posix()}",
    )
    application = create_app(settings)
    Base.metadata.create_all(application.state.engine)
    with Session(application.state.engine) as session:
        session.add(User(id=OWNER_ID))
        session.add(SchemaState(id=1, milestone="M1", created_at="2026-11-15T00:00:00Z"))
        session.commit()
    code = issue_pairing_code(settings)
    with TestClient(application) as client:
        paired = client.post(
            "/api/v1/auth/devices/pair",
            json={"pairing_code": code, "name": "虚构测试设备", "platform": "web"},
        )
        assert paired.status_code == 200
        token = paired.json()["data"]["device_token"]
        yield client, settings, {"Authorization": f"Bearer {token}"}


def create(client: TestClient, headers: dict[str, str], **changes):
    return client.post(
        "/api/v1/records",
        headers={**headers, "Idempotency-Key": str(uuid4())},
        json={**BODY, **changes},
    )


@pytest.mark.parametrize(
    "change",
    [
        {"body_text": ""},
        {"body_text": " \n "},
        {"body_text": "x" * 12001},
        {"captured_at": "2026-11-15T12:00:00"},
        {"timezone": "Invalid/Zone"},
        {"consent_confirmed": False},
        {"people": [" "]},
        {"people": ["x" * 101]},
    ],
)
def test_record_input_rejects_invalid_synthetic_values(m1_client, change) -> None:
    client, _, headers = m1_client
    assert create(client, headers, **change).status_code == 422


def test_original_whitespace_timezone_and_null_patch_contract(m1_client) -> None:
    client, _, headers = m1_client
    record = create(client, headers).json()["data"]
    assert record["body_text"] == BODY["body_text"]
    assert record["captured_at"] == "2026-10-01T06:00:00.000000Z"
    for field in ("body_text", "captured_at", "people", "timezone"):
        response = client.patch(
            f"/api/v1/records/{record['id']}",
            headers=headers,
            json={"expected_version": 1, field: None},
        )
        assert response.status_code == 422
    current = client.get(f"/api/v1/records/{record['id']}", headers=headers).json()["data"]
    assert current["version"] == 1 and current["body_text"] == BODY["body_text"]


def test_simultaneous_idempotency_retries_create_exactly_one_record(m1_client) -> None:
    client, _, headers = m1_client
    request_headers = {**headers, "Idempotency-Key": str(uuid4())}
    with ThreadPoolExecutor(max_workers=6) as pool:
        responses = list(
            pool.map(
                lambda _: client.post("/api/v1/records", headers=request_headers, json=BODY),
                range(6),
            )
        )
    assert all(response.status_code == 201 for response in responses)
    assert len({response.json()["data"]["id"] for response in responses}) == 1
    with Session(client.app.state.engine) as session:
        assert session.scalar(select(func.count()).select_from(SourceRecord)) == 1
    assert (
        client.post(
            "/api/v1/records", headers={**headers, "Idempotency-Key": "not-a-uuid"}, json=BODY
        ).status_code
        == 422
    )


def test_live_requires_server_configuration_and_per_call_consent(m1_client) -> None:
    client, settings, headers = m1_client
    live = Settings(
        _env_file=None,
        app_env="test",
        database_url=settings.database_url,
        mock_mode=False,
        live_ai_enabled=True,
        llm_provider="openai_compatible",
        llm_base_url="https://models.example.com/v1",
        llm_model="synthetic-model",
        llm_api_key="synthetic-key-not-a-secret",
        llm_allowed_hosts="models.example.com",
    )
    client.app.state.settings = live
    client.app.state.memory_provider = MockMemoryProvider()
    metadata = client.get("/api/v1/meta")
    assert metadata.json()["data"]["llm_host"] == "models.example.com"
    assert "synthetic-key-not-a-secret" not in metadata.text
    record = create(client, headers).json()["data"]
    path = f"/api/v1/records/{record['id']}/extract"
    assert client.post(path, headers=headers, json={"allow_live_ai": False}).status_code == 403
    assert client.post(path, headers=headers, json={"allow_live_ai": True}).status_code == 200


def test_provider_failure_preserves_original_and_cannot_write_verified_memory(m1_client) -> None:
    client, _, headers = m1_client
    record = create(client, headers).json()["data"]

    class FailedProvider:
        async def complete_structured(self, *args, **kwargs):
            raise ProviderUnavailable("synthetic-private-error-marker")

    client.app.state.memory_provider = FailedProvider()
    response = client.post(
        f"/api/v1/records/{record['id']}/extract", headers=headers, json={"expected_version": 1}
    )
    assert response.status_code == 502 and "synthetic-private-error-marker" not in response.text
    assert (
        client.get(f"/api/v1/records/{record['id']}", headers=headers).json()["data"]["body_text"]
        == BODY["body_text"]
    )
    with Session(client.app.state.engine) as session:
        assert session.scalar(select(func.count()).select_from(MemoryFact)) == 0
        usage = session.scalar(select(ModelUsage))
        assert usage.status == "failed" and usage.estimate_cost is None


def test_source_revision_during_model_call_rejects_stale_candidates_but_keeps_usage(
    m1_client,
) -> None:
    client, _, headers = m1_client
    record = create(client, headers).json()["data"]

    class RacingProvider(MockMemoryProvider):
        async def complete_structured(self, *args, **kwargs):
            with Session(client.app.state.engine) as session:
                source = session.get(SourceRecord, record["id"])
                source.version += 1
                session.commit()
            return await super().complete_structured(*args, **kwargs)

    client.app.state.memory_provider = RacingProvider()
    assert (
        client.post(
            f"/api/v1/records/{record['id']}/extract", headers=headers, json={"expected_version": 1}
        ).status_code
        == 409
    )
    with Session(client.app.state.engine) as session:
        assert session.scalar(select(func.count()).select_from(MemoryFact)) == 0
        assert session.scalar(select(func.count()).select_from(ModelUsage)) == 1


def test_evidence_versions_time_semantics_and_delete_remove_business_content(m1_client) -> None:
    client, _, headers = m1_client
    record = create(client, headers).json()["data"]
    path = f"/api/v1/records/{record['id']}"
    fact = client.post(path + "/extract", headers=headers, json={"expected_version": 1}).json()[
        "data"
    ]["items"][0]
    assert fact["recorded_at"] == record["created_at"]
    assert fact["event_time"] is None
    assert (
        BODY["body_text"][
            fact["evidence_anchor"]["start_char"] : fact["evidence_anchor"]["end_char"]
        ]
        == fact["evidence_anchor"]["quote"]
    )
    assert (
        client.patch(
            path,
            headers=headers,
            json={"expected_version": 1, "body_text": "虚构修订：王总表示目前只能考虑150万元。"},
        ).status_code
        == 200
    )
    assert (
        client.get(path + "?version=1", headers=headers).json()["data"]["body_text"]
        == BODY["body_text"]
    )
    assert (
        client.get(f"/api/v1/memories/{fact['id']}", headers=headers).json()["data"]["status"]
        == "superseded"
    )
    assert client.delete(path + "?expected_version=2", headers=headers).status_code == 422
    assert (
        client.delete(path + "?expected_version=2&confirm=true", headers=headers).status_code == 200
    )
    assert client.get(path + "?version=1", headers=headers).status_code == 404
    assert client.get(f"/api/v1/memories/{fact['id']}", headers=headers).status_code == 404
    with Session(client.app.state.engine) as session:
        assert session.get(SourceRecord, record["id"]).body_text == ""
        for table in (
            "record_versions",
            "memory_facts",
            "memory_versions",
            "entities",
            "record_entities",
        ):
            assert (
                session.connection().exec_driver_sql(f"SELECT COUNT(*) FROM {table}").scalar() == 0
            )
        audit_rows = session.connection().exec_driver_sql("SELECT * FROM audit_events").all()
        assert "王总" not in repr(audit_rows) and "预算" not in repr(audit_rows)


def test_cross_user_access_revocation_expired_pairing_and_rate_limit(m1_client) -> None:
    client, settings, headers = m1_client
    record = create(client, headers).json()["data"]
    other_id = str(uuid4())
    other_token = str(uuid4())
    with Session(client.app.state.engine) as session:
        session.add(User(id=other_id))
        session.flush()
        session.add(
            Device(
                user_id=other_id,
                name="其他虚构设备",
                platform="windows",
                token_hash=digest(other_token),
            )
        )
        session.commit()
    assert (
        client.get(
            f"/api/v1/records/{record['id']}", headers={"Authorization": f"Bearer {other_token}"}
        ).status_code
        == 404
    )
    device = client.get("/api/v1/auth/devices", headers=headers).json()["data"]["items"][0]
    assert client.delete(f"/api/v1/auth/devices/{device['id']}", headers=headers).status_code == 200
    assert client.get("/api/v1/records", headers=headers).status_code == 401
    code = issue_pairing_code(settings)
    with Session(client.app.state.engine) as session:
        row = session.scalar(select(PairingCode).where(PairingCode.code_hash == digest(code)))
        row.expires_at = "2000-01-01T00:00:00.000000Z"
        session.commit()
    for _ in range(9):
        assert (
            client.post(
                "/api/v1/auth/devices/pair",
                json={"pairing_code": code, "name": "虚构设备", "platform": "other"},
            ).status_code
            == 401
        )
    assert (
        client.post(
            "/api/v1/auth/devices/pair",
            json={"pairing_code": code, "name": "虚构设备", "platform": "other"},
        ).status_code
        == 429
    )


def test_fixed_precision_utc_sorting_and_browser_write_preflight(m1_client) -> None:
    client, _, headers = m1_client
    later = create(client, headers, captured_at="2026-10-01T06:00:00.100000Z").json()["data"]
    earlier = create(client, headers, captured_at="2026-10-01T06:00:00Z").json()["data"]
    listing = client.get("/api/v1/records", headers=headers).json()["data"]["items"]
    assert [item["id"] for item in listing] == [later["id"], earlier["id"]]
    response = client.options(
        "/api/v1/records",
        headers={
            "Origin": "http://localhost:8081",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type,idempotency-key",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:8081"

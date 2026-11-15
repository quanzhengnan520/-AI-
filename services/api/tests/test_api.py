from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def assert_error(response, status: int, code: str) -> None:
    assert response.status_code == status
    body = response.json()
    assert set(body) == {"error", "request_id"}
    assert set(body["error"]) == {"code", "message", "details"}
    assert body["error"]["code"] == code
    assert str(UUID(body["request_id"])) == response.headers["x-request-id"]


def test_health_checks_migrated_database(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["data"] == {"status": "ok", "database": "ok"}
    assert str(UUID(response.json()["request_id"])) == response.headers["x-request-id"]


def test_unmigrated_database_fails_safely(settings: Settings) -> None:
    with TestClient(create_app(settings)) as client:
        response = client.get("/health")
    assert_error(response, 503, "DATABASE_NOT_READY")
    assert "SQL" not in response.text


def test_metadata_is_public_mock_only_and_redacted(client: TestClient, token: str) -> None:
    response = client.get("/api/v1/meta")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["api_version"] == "v1"
    assert data["milestone"] == "M0"
    assert data["mode"] == "mock"
    assert data["live_ai_enabled"] is False
    assert data["llm_provider"] == data["asr_provider"] == "mock"
    assert "演示数据" in data["label"]
    assert token not in response.text
    assert "device_token_sha256" not in response.text
    assert "database_url" not in response.text


@pytest.mark.parametrize("header", [None, "Bearer incorrect", "Basic incorrect"])
def test_sample_requires_valid_device_auth(client: TestClient, header: str | None) -> None:
    headers = {"Authorization": header} if header else {}
    response = client.get("/api/v1/demo", headers=headers)
    assert_error(response, 401, "UNAUTHORIZED")
    assert response.headers["www-authenticate"] == "Bearer"


def test_unconfigured_token_disables_sample(settings: Settings) -> None:
    settings = settings.model_copy(update={"device_token_sha256": ""})
    with TestClient(create_app(settings)) as client:
        response = client.get("/api/v1/demo", headers={"Authorization": "Bearer anything"})
    assert_error(response, 401, "UNAUTHORIZED")


def test_authentication_returns_bounded_synthetic_resource(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    response = client.get("/api/v1/demo?limit=1", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["mock"] is True
    assert "虚构" in data["label"]
    assert len(data["records"]) == 1
    record = data["records"][0]
    assert record["mock"] is True
    assert record["captured_at"].endswith("Z")
    assert record["version"] == 1
    UUID(record["id"])


@pytest.mark.parametrize("limit", ["0", "101", "private-input-do-not-echo"])
def test_input_validation_is_structured_and_does_not_echo_input(
    client: TestClient, auth_headers: dict[str, str], limit: str
) -> None:
    response = client.get("/api/v1/demo", params={"limit": limit}, headers=auth_headers)
    assert_error(response, 422, "VALIDATION_ERROR")
    assert "private-input-do-not-echo" not in response.text
    assert "input" not in response.json()["error"]["details"]


@pytest.mark.parametrize(
    ("method", "path", "status", "code"),
    [("get", "/does-not-exist", 404, "NOT_FOUND"), ("post", "/health", 405, "METHOD_NOT_ALLOWED")],
)
def test_route_errors_share_contract(client: TestClient, method, path, status, code) -> None:
    response = getattr(client, method)(path)
    assert_error(response, status, code)


def test_actual_request_body_size_is_limited(client: TestClient) -> None:
    response = client.post("/health", content=b"private-marker" * 4000)
    assert_error(response, 413, "REQUEST_TOO_LARGE")
    assert "private-marker" not in response.text


def test_unexpected_failure_does_not_leak_details(application: FastAPI) -> None:
    @application.get("/test/failure", include_in_schema=False)
    def fail():
        raise RuntimeError("private-marker-do-not-leak")

    with TestClient(application) as client:
        response = client.get("/test/failure")
    assert_error(response, 500, "INTERNAL_ERROR")
    assert "private-marker" not in response.text


def test_request_id_is_fresh_and_untrusted_header_is_ignored(client: TestClient) -> None:
    first = client.get("/api/v1/meta", headers={"X-Request-ID": "private-marker"})
    second = client.get("/api/v1/meta")
    assert first.json()["request_id"] != second.json()["request_id"]
    assert "private-marker" not in first.text


def test_local_browser_origin_can_read_metadata(client: TestClient) -> None:
    response = client.get("/api/v1/meta", headers={"Origin": "http://localhost:8081"})
    assert response.headers["access-control-allow-origin"] == "http://localhost:8081"
    assert response.headers["access-control-expose-headers"] == "X-Request-ID"


def test_unknown_origin_is_not_allowed(client: TestClient) -> None:
    response = client.get("/api/v1/meta", headers={"Origin": "https://untrusted.invalid"})
    assert "access-control-allow-origin" not in response.headers


def test_business_routes_require_pairing_after_m1_implementation(client: TestClient) -> None:
    # M0's unavailable endpoint becomes a protected M1 endpoint.
    assert_error(client.post("/api/v1/records", json={}), 401, "UNAUTHORIZED")

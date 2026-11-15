import hashlib
import secrets
from collections.abc import Iterator
from datetime import UTC, datetime

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.config import Settings
from app.database import Base, SchemaState
from app.main import create_app


@pytest.fixture
def token() -> str:
    return secrets.token_urlsafe(32)


@pytest.fixture
def settings(token: str) -> Settings:
    return Settings(
        _env_file=None,
        app_env="test",
        database_url="sqlite:///:memory:",
        device_token_sha256=hashlib.sha256(token.encode()).hexdigest(),
    )


@pytest.fixture
def application(settings: Settings) -> FastAPI:
    application = create_app(settings)
    engine = application.state.engine
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        session.add(
            SchemaState(
                id=1,
                milestone="M0",
                created_at=datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            )
        )
        session.commit()
    return application


@pytest.fixture
def client(application: FastAPI) -> Iterator[TestClient]:
    with TestClient(application) as client:
        yield client


@pytest.fixture
def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}

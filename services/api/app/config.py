"""Server-only configuration. Paths are relative to the API project, never caller cwd."""

from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

API_ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=API_ROOT / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_env: Literal["development", "test"] = "development"
    mock_mode: bool = True
    live_ai_enabled: bool = False
    database_url: str = "sqlite:///./data/secondbrain.db"
    app_timezone: str = "Asia/Shanghai"
    device_token_sha256: str = Field(default="", repr=False)
    cors_origins: str = "http://localhost:8081,http://127.0.0.1:8081"
    max_request_bytes: int = Field(default=32768, ge=1024, le=1048576)
    llm_provider: Literal["mock"] = "mock"
    asr_provider: Literal["mock"] = "mock"

    @field_validator("device_token_sha256")
    @classmethod
    def validate_token_hash(cls, value: str) -> str:
        value = value.strip().lower()
        if value and (len(value) != 64 or any(c not in "0123456789abcdef" for c in value)):
            raise ValueError("DEVICE_TOKEN_SHA256 must be an empty value or SHA-256 hex digest")
        return value

    @field_validator("database_url")
    @classmethod
    def local_sqlite_only(cls, value: str) -> str:
        if not value.startswith("sqlite:///"):
            raise ValueError("M0 supports local SQLite only")
        return value

    @model_validator(mode="after")
    def require_mock(self) -> "Settings":
        if not self.mock_mode or self.live_ai_enabled:
            raise ValueError("M0 supports Mock only; live providers are not implemented")
        return self

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def resolved_database_url(self) -> str:
        raw_path = self.database_url.removeprefix("sqlite:///")
        if raw_path == ":memory:":
            return self.database_url
        db_path = Path(raw_path)
        if not db_path.is_absolute():
            db_path = API_ROOT / db_path
        return "sqlite:///" + db_path.resolve().as_posix()

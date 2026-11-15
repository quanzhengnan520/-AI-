"""M1 relational storage. No original text is written to audit or credential tables."""

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

OWNER_ID = "e5f9ac84-f8c2-41f6-8643-5ac0c00a1001"


def now() -> str:
    return datetime.now(UTC).isoformat(timespec="microseconds").replace("+00:00", "Z")


def identifier() -> str:
    return str(uuid4())


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(primary_key=True)
    locale: Mapped[str] = mapped_column(default="zh-CN")
    timezone: Mapped[str] = mapped_column(default="Asia/Shanghai")
    created_at: Mapped[str] = mapped_column(default=now)


class Device(Base):
    __tablename__ = "devices"
    id: Mapped[str] = mapped_column(primary_key=True, default=identifier)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str]
    platform: Mapped[str]
    token_hash: Mapped[str] = mapped_column(unique=True)
    revoked_at: Mapped[str | None]
    created_at: Mapped[str] = mapped_column(default=now)
    last_seen_at: Mapped[str | None]


class PairingCode(Base):
    __tablename__ = "pairing_codes"
    id: Mapped[str] = mapped_column(primary_key=True, default=identifier)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    code_hash: Mapped[str] = mapped_column(unique=True)
    expires_at: Mapped[str]
    consumed_at: Mapped[str | None]
    created_at: Mapped[str] = mapped_column(default=now)


class PairingAttempt(Base):
    __tablename__ = "pairing_attempts"
    id: Mapped[str] = mapped_column(primary_key=True, default=identifier)
    client_hash: Mapped[str] = mapped_column(index=True)
    attempted_at: Mapped[str] = mapped_column(index=True)


class SourceRecord(Base):
    __tablename__ = "source_records"
    id: Mapped[str] = mapped_column(primary_key=True, default=identifier)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str]
    body_text: Mapped[str]
    captured_at: Mapped[str] = mapped_column(index=True)
    timezone: Mapped[str]
    consent_confirmed: Mapped[bool]
    status: Mapped[str] = mapped_column(default="saved")
    retention_days: Mapped[int] = mapped_column(default=30)
    expires_at: Mapped[str]
    version: Mapped[int] = mapped_column(default=1)
    created_at: Mapped[str] = mapped_column(default=now)
    updated_at: Mapped[str] = mapped_column(default=now)
    deleted_at: Mapped[str | None]
    __table_args__ = (Index("ix_record_timeline", "user_id", "captured_at", "id"),)


class RecordVersion(Base):
    __tablename__ = "record_versions"
    id: Mapped[str] = mapped_column(primary_key=True, default=identifier)
    record_id: Mapped[str] = mapped_column(ForeignKey("source_records.id"), index=True)
    version: Mapped[int]
    snapshot_json: Mapped[str]
    created_at: Mapped[str] = mapped_column(default=now)
    __table_args__ = (UniqueConstraint("record_id", "version"),)


class Entity(Base):
    __tablename__ = "entities"
    id: Mapped[str] = mapped_column(primary_key=True, default=identifier)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    kind: Mapped[str]
    display_name: Mapped[str]
    created_at: Mapped[str] = mapped_column(default=now)
    version: Mapped[int] = mapped_column(default=1)
    __table_args__ = (UniqueConstraint("user_id", "kind", "display_name"),)


class RecordEntity(Base):
    __tablename__ = "record_entities"
    record_id: Mapped[str] = mapped_column(ForeignKey("source_records.id"), primary_key=True)
    entity_id: Mapped[str] = mapped_column(ForeignKey("entities.id"), primary_key=True)


class MemoryFact(Base):
    __tablename__ = "memory_facts"
    id: Mapped[str] = mapped_column(primary_key=True, default=identifier)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    source_record_id: Mapped[str] = mapped_column(ForeignKey("source_records.id"), index=True)
    source_record_version: Mapped[int]
    subject: Mapped[str]
    predicate: Mapped[str]
    object_text: Mapped[str]
    modality: Mapped[str]
    attribution: Mapped[str | None]
    event_time: Mapped[str | None]
    recorded_at: Mapped[str]
    evidence_start_char: Mapped[int]
    evidence_end_char: Mapped[int]
    evidence_excerpt: Mapped[str]
    status: Mapped[str] = mapped_column(default="candidate", index=True)
    certainty: Mapped[str]
    mock: Mapped[bool]
    version: Mapped[int] = mapped_column(default=1)
    created_at: Mapped[str] = mapped_column(default=now)
    updated_at: Mapped[str] = mapped_column(default=now)
    deleted_at: Mapped[str | None]
    __table_args__ = (
        UniqueConstraint(
            "source_record_id", "source_record_version", "evidence_start_char", "evidence_end_char"
        ),
    )


class MemoryVersion(Base):
    __tablename__ = "memory_versions"
    id: Mapped[str] = mapped_column(primary_key=True, default=identifier)
    fact_id: Mapped[str] = mapped_column(ForeignKey("memory_facts.id"), index=True)
    version: Mapped[int]
    snapshot_json: Mapped[str]
    reason: Mapped[str]
    changed_by: Mapped[str]
    created_at: Mapped[str] = mapped_column(default=now)


class IdempotencyEntry(Base):
    __tablename__ = "idempotency_entries"
    id: Mapped[str] = mapped_column(primary_key=True, default=identifier)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    key: Mapped[str]
    payload_hash: Mapped[str]
    record_id: Mapped[str] = mapped_column(ForeignKey("source_records.id"))
    created_at: Mapped[str] = mapped_column(default=now)
    __table_args__ = (UniqueConstraint("user_id", "key"),)


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[str] = mapped_column(primary_key=True, default=identifier)
    user_id: Mapped[str] = mapped_column(index=True)
    actor: Mapped[str]
    operation: Mapped[str]
    target_type: Mapped[str]
    target_id: Mapped[str]
    request_id: Mapped[str]
    created_at: Mapped[str] = mapped_column(default=now)


class ModelUsage(Base):
    __tablename__ = "model_usage"
    id: Mapped[str] = mapped_column(primary_key=True, default=identifier)
    user_id: Mapped[str] = mapped_column(index=True)
    request_id: Mapped[str]
    provider: Mapped[str]
    model: Mapped[str]
    task_type: Mapped[str] = mapped_column(default="extract")
    status: Mapped[str]
    input_tokens: Mapped[int | None]
    output_tokens: Mapped[int | None]
    estimate_cost: Mapped[str | None]
    price_config_version: Mapped[str] = mapped_column(default="unconfigured")
    created_at: Mapped[str] = mapped_column(default=now)

"""Transactional text storage, versioned evidence and deletion propagation."""

import base64
import json
from datetime import timedelta
from typing import Any

from sqlalchemy import delete, exists, select
from sqlalchemy.orm import Session

from app.contracts import RecordCreate, utc
from app.errors import APIError
from app.models import (
    AuditEvent,
    Entity,
    MemoryFact,
    MemoryVersion,
    RecordEntity,
    RecordVersion,
    SourceRecord,
    now,
)

LINKS = {"people": "person", "projects": "project", "events": "event"}


def audit(
    session: Session,
    user_id: str,
    actor: str,
    operation: str,
    kind: str,
    target: str,
    request_id: str,
) -> None:
    session.add(
        AuditEvent(
            user_id=user_id,
            actor=actor,
            operation=operation,
            target_type=kind,
            target_id=target,
            request_id=request_id,
        )
    )


def get_record(session: Session, user_id: str, record_id: str) -> SourceRecord:
    record = session.scalar(
        select(SourceRecord).where(
            SourceRecord.id == record_id,
            SourceRecord.user_id == user_id,
            SourceRecord.deleted_at.is_(None),
        )
    )
    if record is None:
        raise APIError(404, "NOT_FOUND", "没有找到此记录。")
    return record


def get_memory(session: Session, user_id: str, fact_id: str) -> MemoryFact:
    fact = session.scalar(
        select(MemoryFact).where(
            MemoryFact.id == fact_id, MemoryFact.user_id == user_id, MemoryFact.deleted_at.is_(None)
        )
    )
    if fact is None:
        raise APIError(404, "NOT_FOUND", "没有找到此记忆。")
    get_record(session, user_id, fact.source_record_id)
    return fact


def check_version(actual: int, expected: int) -> None:
    if actual != expected:
        raise APIError(409, "VERSION_CONFLICT", "内容已更新，请重新读取后再修改。")


def links(session: Session, record_id: str) -> dict[str, list[str]]:
    entities = session.scalars(
        select(Entity)
        .join(RecordEntity, RecordEntity.entity_id == Entity.id)
        .where(RecordEntity.record_id == record_id)
    ).all()
    return {
        name: sorted(entity.display_name for entity in entities if entity.kind == kind)
        for name, kind in LINKS.items()
    }


def set_links(session: Session, record: SourceRecord, values: dict[str, Any]) -> None:
    current = links(session, record.id)
    session.execute(delete(RecordEntity).where(RecordEntity.record_id == record.id))
    for field, kind in LINKS.items():
        for name in values.get(field, current[field]):
            entity = session.scalar(
                select(Entity).where(
                    Entity.user_id == record.user_id,
                    Entity.kind == kind,
                    Entity.display_name == name,
                )
            )
            if entity is None:
                entity = Entity(user_id=record.user_id, kind=kind, display_name=name)
                session.add(entity)
                session.flush()
            session.add(RecordEntity(record_id=record.id, entity_id=entity.id))
    session.flush()


def record_data(session: Session, record: SourceRecord) -> dict[str, Any]:
    return {
        "id": record.id,
        "kind": "text",
        "title": record.title,
        "body_text": record.body_text,
        "captured_at": record.captured_at,
        "timezone": record.timezone,
        "status": record.status,
        "consent_confirmed": record.consent_confirmed,
        "retention_days": record.retention_days,
        "expires_at": record.expires_at,
        "version": record.version,
        "created_at": record.created_at,
        "updated_at": record.updated_at,
        "deleted_at": record.deleted_at,
        **links(session, record.id),
    }


def save_record_version(session: Session, record: SourceRecord) -> dict[str, Any]:
    snapshot = record_data(session, record)
    session.add(
        RecordVersion(
            record_id=record.id,
            version=record.version,
            snapshot_json=json.dumps(snapshot, ensure_ascii=False),
        )
    )
    return snapshot


def source_version(session: Session, record: SourceRecord, version: int) -> dict[str, Any]:
    if version == record.version:
        return record_data(session, record)
    saved = session.scalar(
        select(RecordVersion).where(
            RecordVersion.record_id == record.id, RecordVersion.version == version
        )
    )
    if saved is None:
        raise APIError(404, "SOURCE_VERSION_UNAVAILABLE", "没有找到此来源版本。")
    result: dict[str, Any] = json.loads(saved.snapshot_json)
    return result


def memory_data(fact: MemoryFact, record: SourceRecord | None = None) -> dict[str, Any]:
    return {
        "id": fact.id,
        "source_record_id": fact.source_record_id,
        "source_record_version": fact.source_record_version,
        "subject": fact.subject,
        "predicate": fact.predicate,
        "object_text": fact.object_text,
        "modality": fact.modality,
        "attribution": fact.attribution,
        "event_time": fact.event_time,
        "recorded_at": fact.recorded_at,
        "status": fact.status,
        "certainty": fact.certainty,
        "mock": fact.mock,
        "version": fact.version,
        "created_at": fact.created_at,
        "updated_at": fact.updated_at,
        "evidence_anchor": {
            "start_char": fact.evidence_start_char,
            "end_char": fact.evidence_end_char,
            "quote": fact.evidence_excerpt,
        },
        "evidence_status": "available"
        if record is None or record.deleted_at is None
        else "original_deleted",
    }


def save_memory_version(session: Session, fact: MemoryFact, reason: str, actor: str) -> None:
    session.add(
        MemoryVersion(
            fact_id=fact.id,
            version=fact.version,
            snapshot_json=json.dumps(memory_data(fact), ensure_ascii=False),
            reason=reason,
            changed_by=actor,
        )
    )


def new_record(payload: RecordCreate, user_id: str) -> SourceRecord:
    return SourceRecord(
        user_id=user_id,
        title=payload.title,
        body_text=payload.body_text,
        captured_at=utc(payload.captured_at),
        timezone=payload.timezone,
        consent_confirmed=True,
        expires_at=utc(payload.captured_at + timedelta(days=30)),
    )


def remove_record_content(session: Session, record: SourceRecord) -> None:
    fact_ids = select(MemoryFact.id).where(MemoryFact.source_record_id == record.id)
    session.execute(delete(MemoryVersion).where(MemoryVersion.fact_id.in_(fact_ids)))
    session.execute(delete(MemoryFact).where(MemoryFact.source_record_id == record.id))
    session.execute(delete(RecordVersion).where(RecordVersion.record_id == record.id))
    session.execute(delete(RecordEntity).where(RecordEntity.record_id == record.id))
    session.flush()
    session.execute(
        delete(Entity).where(
            Entity.user_id == record.user_id, ~exists().where(RecordEntity.entity_id == Entity.id)
        )
    )
    record.title = ""
    record.body_text = ""
    record.status = "deleted"
    record.deleted_at = now()
    record.updated_at = record.deleted_at
    record.version += 1


def page(items: list[dict[str, Any]], limit: int, offset: int) -> dict[str, Any]:
    more = len(items) > limit
    next_cursor = base64.urlsafe_b64encode(str(offset + limit).encode()).decode() if more else None
    return {"items": items[:limit], "next_cursor": next_cursor}


def cursor_offset(cursor: str | None) -> int:
    if cursor is None:
        return 0
    try:
        if len(cursor) > 24:
            raise ValueError
        value = int(base64.urlsafe_b64decode(cursor.encode()).decode())
        if value < 0 or value > 1_000_000:
            raise ValueError
        return value
    except (ValueError, UnicodeError):
        raise APIError(422, "INVALID_CURSOR", "分页游标不合法。") from None

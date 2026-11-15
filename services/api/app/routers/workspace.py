"""M1 single-user HTTP API; all private resources use persistent device authorization."""

import hashlib
import json
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Request
from sqlalchemy import exists, or_, select
from sqlalchemy.orm import Session

from app.auth import Principal, consume_pairing_code, current_device
from app.contracts import (
    ExtractInput,
    PairInput,
    QueryInput,
    RecordCreate,
    RecordPatch,
    ReviewInput,
    utc,
)
from app.errors import APIError
from app.models import (
    Device,
    Entity,
    IdempotencyEntry,
    MemoryFact,
    MemoryVersion,
    ModelUsage,
    RecordEntity,
    RecordVersion,
    SourceRecord,
    now,
)
from app.providers.base import ProviderUnavailable
from app.providers.live import OpenAICompatibleLLMProvider
from app.providers.memory import extract_candidates
from app.store import (
    audit,
    check_version,
    cursor_offset,
    get_memory,
    get_record,
    links,
    memory_data,
    new_record,
    page,
    record_data,
    remove_record_content,
    save_memory_version,
    save_record_version,
    set_links,
    source_version,
)

router = APIRouter(prefix="/api/v1")
Authenticated = Annotated[Principal, Depends(current_device)]
Limit = Annotated[int, Query(ge=1, le=100)]


def envelope(request: Request, data: Any) -> dict[str, Any]:
    return {"data": data, "request_id": request.state.request_id}


@router.post("/auth/devices/pair")
def pair_device(request: Request, payload: PairInput) -> dict[str, Any]:
    return envelope(
        request, consume_pairing_code(request, payload.pairing_code, payload.name, payload.platform)
    )


@router.get("/auth/devices")
def devices(request: Request, principal: Authenticated) -> dict[str, Any]:
    with Session(request.app.state.engine) as session:
        items = session.scalars(
            select(Device).where(Device.user_id == principal.user_id).order_by(Device.created_at)
        ).all()
        return envelope(
            request,
            {
                "items": [
                    {
                        "id": item.id,
                        "name": item.name,
                        "platform": item.platform,
                        "revoked_at": item.revoked_at,
                        "created_at": item.created_at,
                    }
                    for item in items
                ],
                "next_cursor": None,
            },
        )


@router.delete("/auth/devices/{device_id}")
def revoke_device(request: Request, device_id: UUID, principal: Authenticated) -> dict[str, Any]:
    with Session(request.app.state.engine) as session:
        session.connection().exec_driver_sql("BEGIN IMMEDIATE")
        device = session.scalar(
            select(Device).where(Device.id == str(device_id), Device.user_id == principal.user_id)
        )
        if device is None:
            raise APIError(404, "NOT_FOUND", "没有找到此设备。")
        device.revoked_at = now()
        audit(
            session,
            principal.user_id,
            principal.device_id,
            "revoke",
            "device",
            device.id,
            request.state.request_id,
        )
        session.commit()
    return envelope(request, {"id": str(device_id), "revoked": True})


@router.post("/records", status_code=201)
def create_record(
    request: Request,
    payload: RecordCreate,
    principal: Authenticated,
    idempotency_key: Annotated[UUID, Header(alias="Idempotency-Key")],
) -> dict[str, Any]:
    key = str(idempotency_key)
    fingerprint = hashlib.sha256(
        json.dumps(payload.model_dump(mode="json"), sort_keys=True, ensure_ascii=False).encode()
    ).hexdigest()
    with Session(request.app.state.engine) as session:
        session.connection().exec_driver_sql("BEGIN IMMEDIATE")
        entry = session.scalar(
            select(IdempotencyEntry).where(
                IdempotencyEntry.user_id == principal.user_id,
                IdempotencyEntry.key == key,
            )
        )
        if entry is not None:
            if entry.payload_hash != fingerprint:
                raise APIError(409, "IDEMPOTENCY_CONFLICT", "同一个同步标识不能用于不同内容。")
            record = session.get(SourceRecord, entry.record_id)
            if record is None or record.deleted_at:
                raise APIError(409, "RECORD_DELETED", "此同步标识对应的记录已删除，不能重放恢复。")
            return envelope(request, record_data(session, record))
        record = new_record(payload, principal.user_id)
        session.add(record)
        session.flush()
        set_links(session, record, payload.model_dump())
        result = save_record_version(session, record)
        session.add(
            IdempotencyEntry(
                user_id=principal.user_id,
                key=key,
                payload_hash=fingerprint,
                record_id=record.id,
            )
        )
        audit(
            session,
            principal.user_id,
            principal.device_id,
            "create",
            "record",
            record.id,
            request.state.request_id,
        )
        session.commit()
        return envelope(request, result)


def association(name: str, kind: str | None = None) -> Any:
    conditions = [
        RecordEntity.record_id == SourceRecord.id,
        RecordEntity.entity_id == Entity.id,
        Entity.display_name == name,
    ]
    if kind is not None:
        conditions.append(Entity.kind == kind)
    return exists().where(*conditions)


@router.get("/records")
def list_records(
    request: Request,
    principal: Authenticated,
    q: Annotated[str, Query(max_length=200)] = "",
    person: Annotated[str | None, Query(max_length=100)] = None,
    project: Annotated[str | None, Query(max_length=100)] = None,
    event: Annotated[str | None, Query(max_length=100)] = None,
    limit: Limit = 20,
    cursor: str | None = None,
) -> dict[str, Any]:
    offset = cursor_offset(cursor)
    with Session(request.app.state.engine) as session:
        statement = select(SourceRecord).where(
            SourceRecord.user_id == principal.user_id, SourceRecord.deleted_at.is_(None)
        )
        if q.strip():
            matching_entity = exists().where(
                RecordEntity.record_id == SourceRecord.id,
                RecordEntity.entity_id == Entity.id,
                Entity.display_name.contains(q.strip(), autoescape=True),
            )
            statement = statement.where(
                or_(
                    SourceRecord.title.contains(q.strip(), autoescape=True),
                    SourceRecord.body_text.contains(q.strip(), autoescape=True),
                    matching_entity,
                )
            )
        for value, kind in ((person, "person"), (project, "project"), (event, "event")):
            if value:
                statement = statement.where(association(value, kind))
        records = session.scalars(
            statement.order_by(SourceRecord.captured_at.desc(), SourceRecord.id.desc())
            .offset(offset)
            .limit(limit + 1)
        ).all()
        items = []
        for record in records:
            item = record_data(session, record)
            item["body_text"] = record.body_text[:300]
            item["body_truncated"] = len(record.body_text) > 300
            items.append(item)
        return envelope(request, page(items, limit, offset))


@router.get("/records/{record_id}")
def read_record(
    request: Request,
    record_id: UUID,
    principal: Authenticated,
    version: Annotated[int | None, Query(ge=1)] = None,
) -> dict[str, Any]:
    with Session(request.app.state.engine) as session:
        record = get_record(session, principal.user_id, str(record_id))
        return envelope(
            request,
            source_version(session, record, version) if version else record_data(session, record),
        )


@router.get("/records/{record_id}/versions")
def record_versions(request: Request, record_id: UUID, principal: Authenticated) -> dict[str, Any]:
    with Session(request.app.state.engine) as session:
        get_record(session, principal.user_id, str(record_id))
        revisions = session.scalars(
            select(RecordVersion)
            .where(RecordVersion.record_id == str(record_id))
            .order_by(RecordVersion.version)
        ).all()
        return envelope(
            request,
            {
                "items": [
                    {"version": item.version, "created_at": item.created_at} for item in revisions
                ],
                "next_cursor": None,
            },
        )


@router.patch("/records/{record_id}")
def patch_record(
    request: Request, record_id: UUID, payload: RecordPatch, principal: Authenticated
) -> dict[str, Any]:
    changes = payload.model_dump(exclude_unset=True, exclude={"expected_version"})
    if not changes:
        raise APIError(422, "EMPTY_UPDATE", "请至少修改一个字段。")
    with Session(request.app.state.engine) as session:
        session.connection().exec_driver_sql("BEGIN IMMEDIATE")
        record = get_record(session, principal.user_id, str(record_id))
        check_version(record.version, payload.expected_version)
        for field in ("title", "body_text", "timezone"):
            if field in changes:
                setattr(record, field, changes[field])
        if payload.captured_at is not None:
            from datetime import timedelta

            record.captured_at = utc(payload.captured_at)
            record.expires_at = utc(payload.captured_at + timedelta(days=record.retention_days))
        set_links(session, record, changes)
        record.version += 1
        record.updated_at = now()
        old_facts = session.scalars(
            select(MemoryFact).where(
                MemoryFact.source_record_id == record.id, MemoryFact.status != "superseded"
            )
        ).all()
        for fact in old_facts:
            fact.status = "superseded"
            fact.version += 1
            fact.updated_at = now()
            save_memory_version(session, fact, "source_revised", "system")
        result = save_record_version(session, record)
        audit(
            session,
            principal.user_id,
            principal.device_id,
            "revise",
            "record",
            record.id,
            request.state.request_id,
        )
        session.commit()
        return envelope(request, result)


@router.delete("/records/{record_id}")
def delete_record(
    request: Request,
    record_id: UUID,
    principal: Authenticated,
    expected_version: Annotated[int, Query(ge=1)],
    confirm: bool = False,
) -> dict[str, Any]:
    if not confirm:
        raise APIError(
            422,
            "DELETE_CONFIRMATION_REQUIRED",
            "删除将清除原文、全部修订版本与关联记忆，请先确认影响。",
        )
    with Session(request.app.state.engine) as session:
        session.connection().exec_driver_sql("BEGIN IMMEDIATE")
        record = get_record(session, principal.user_id, str(record_id))
        check_version(record.version, expected_version)
        remove_record_content(session, record)
        audit(
            session,
            principal.user_id,
            principal.device_id,
            "delete_with_derivatives",
            "record",
            record.id,
            request.state.request_id,
        )
        session.commit()
    return envelope(
        request,
        {
            "id": str(record_id),
            "deleted": True,
            "derived_memories_deleted": True,
            "history_deleted": True,
        },
    )


@router.get("/entities")
def entities(
    request: Request, principal: Authenticated, limit: Limit = 20, cursor: str | None = None
) -> dict[str, Any]:
    offset = cursor_offset(cursor)
    with Session(request.app.state.engine) as session:
        rows = session.scalars(
            select(Entity)
            .where(Entity.user_id == principal.user_id)
            .order_by(Entity.kind, Entity.display_name, Entity.id)
            .offset(offset)
            .limit(limit + 1)
        ).all()
        return envelope(
            request,
            page(
                [
                    {
                        "id": item.id,
                        "kind": item.kind,
                        "display_name": item.display_name,
                        "version": item.version,
                    }
                    for item in rows
                ],
                limit,
                offset,
            ),
        )


@router.get("/memories")
def list_memories(
    request: Request,
    principal: Authenticated,
    status: str | None = None,
    q: Annotated[str, Query(max_length=200)] = "",
    person: str | None = None,
    project: str | None = None,
    event: str | None = None,
    source_record_id: UUID | None = None,
    limit: Limit = 20,
    cursor: str | None = None,
) -> dict[str, Any]:
    offset = cursor_offset(cursor)
    allowed = {"candidate", "needs_review", "verified_by_user", "rejected", "superseded"}
    if status and status not in allowed:
        raise APIError(422, "INVALID_STATUS", "记忆状态不合法。")
    with Session(request.app.state.engine) as session:
        statement = (
            select(MemoryFact)
            .join(SourceRecord, SourceRecord.id == MemoryFact.source_record_id)
            .where(
                MemoryFact.user_id == principal.user_id,
                MemoryFact.deleted_at.is_(None),
                SourceRecord.deleted_at.is_(None),
            )
        )
        if status:
            statement = statement.where(MemoryFact.status == status)
        if source_record_id:
            statement = statement.where(MemoryFact.source_record_id == str(source_record_id))
        if q.strip():
            statement = statement.where(
                or_(
                    MemoryFact.object_text.contains(q.strip(), autoescape=True),
                    MemoryFact.subject.contains(q.strip(), autoescape=True),
                )
            )
        for value, kind in ((person, "person"), (project, "project"), (event, "event")):
            if value:
                statement = statement.where(association(value, kind))
        facts = session.scalars(
            statement.order_by(MemoryFact.recorded_at.desc(), MemoryFact.id.desc())
            .offset(offset)
            .limit(limit + 1)
        ).all()
        return envelope(request, page([memory_data(fact) for fact in facts], limit, offset))


@router.get("/memories/{fact_id}")
def read_memory(request: Request, fact_id: UUID, principal: Authenticated) -> dict[str, Any]:
    with Session(request.app.state.engine) as session:
        fact = get_memory(session, principal.user_id, str(fact_id))
        return envelope(request, memory_data(fact))


@router.get("/memories/{fact_id}/versions")
def memory_versions(request: Request, fact_id: UUID, principal: Authenticated) -> dict[str, Any]:
    with Session(request.app.state.engine) as session:
        fact = get_memory(session, principal.user_id, str(fact_id))
        revisions = session.scalars(
            select(MemoryVersion)
            .where(MemoryVersion.fact_id == fact.id)
            .order_by(MemoryVersion.version)
        ).all()
        return envelope(
            request,
            {
                "items": [
                    {
                        **json.loads(item.snapshot_json),
                        "change_reason": item.reason,
                        "changed_by": item.changed_by,
                    }
                    for item in revisions
                ],
                "next_cursor": None,
            },
        )


@router.patch("/memories/{fact_id}")
def review_memory(
    request: Request, fact_id: UUID, payload: ReviewInput, principal: Authenticated
) -> dict[str, Any]:
    if payload.review_action == "correct" and not payload.corrected_object_text:
        raise APIError(422, "CORRECTION_REQUIRED", "修改记忆时请填写修正后的内容。")
    if payload.review_action != "correct" and payload.corrected_object_text is not None:
        raise APIError(422, "INVALID_REVIEW", "确认或驳回不能同时悄悄修改内容。")
    with Session(request.app.state.engine) as session:
        session.connection().exec_driver_sql("BEGIN IMMEDIATE")
        fact = get_memory(session, principal.user_id, str(fact_id))
        check_version(fact.version, payload.expected_version)
        if fact.status == "superseded":
            raise APIError(409, "SOURCE_REVISED", "原始记录已修订，请审核新版本候选。")
        if payload.review_action == "correct":
            fact.object_text = payload.corrected_object_text or fact.object_text
            fact.status = "needs_review"
        else:
            fact.status = "verified_by_user" if payload.review_action == "verify" else "rejected"
        fact.version += 1
        fact.updated_at = now()
        save_memory_version(session, fact, payload.review_action, "user")
        audit(
            session,
            principal.user_id,
            principal.device_id,
            payload.review_action,
            "memory",
            fact.id,
            request.state.request_id,
        )
        result = memory_data(fact)
        session.commit()
        return envelope(request, result)


@router.post("/records/{record_id}/extract")
async def extract_record(
    request: Request, record_id: UUID, principal: Authenticated, payload: ExtractInput | None = None
) -> dict[str, Any]:
    payload = payload or ExtractInput()
    settings = request.app.state.settings
    is_live = settings.llm_provider == "openai_compatible"
    if is_live and not payload.allow_live_ai:
        raise APIError(
            403, "LIVE_CONSENT_REQUIRED", "此提取会发送原文至配置的模型服务，请先明确同意。"
        )
    with Session(request.app.state.engine) as session:
        record = get_record(session, principal.user_id, str(record_id))
        if payload.expected_version is not None:
            check_version(record.version, payload.expected_version)
        version = record.version
        existing = session.scalars(
            select(MemoryFact).where(
                MemoryFact.source_record_id == record.id,
                MemoryFact.source_record_version == version,
            )
        ).all()
        if existing:
            return envelope(
                request,
                {
                    "items": [memory_data(fact) for fact in existing],
                    "provider": settings.llm_provider,
                },
            )
        body_text, captured_at = record.body_text, record.captured_at
        people = links(session, record.id)["people"]
    provider = getattr(request.app.state, "memory_provider", None)
    if provider is None and is_live:
        provider = OpenAICompatibleLLMProvider(
            base_url=settings.llm_base_url,
            model=settings.llm_model,
            api_key=settings.llm_api_key.get_secret_value(),
            allowed_hosts=[
                item.strip() for item in settings.llm_allowed_hosts.split(",") if item.strip()
            ],
            live_enabled=settings.live_ai_enabled,
        )
    usage_status = "succeeded"
    try:
        candidates = await extract_candidates(
            body_text, people, captured_at, provider, request.state.request_id
        )
    except ProviderUnavailable:
        usage_status = "failed"
        candidates = []
    with Session(request.app.state.engine) as session:
        session.connection().exec_driver_sql("BEGIN IMMEDIATE")
        session.add(
            ModelUsage(
                user_id=principal.user_id,
                request_id=request.state.request_id,
                provider=settings.llm_provider,
                model=settings.llm_model if is_live else "extractive-mock-v1",
                status=usage_status,
                input_tokens=None,
                output_tokens=None,
                estimate_cost=None,
            )
        )
        session.commit()
        if usage_status == "failed":
            raise APIError(
                502, "PROVIDER_UNAVAILABLE", "候选提取失败；原始文字仍已保存，可稍后重试。"
            )
    with Session(request.app.state.engine) as session:
        session.connection().exec_driver_sql("BEGIN IMMEDIATE")
        record = get_record(session, principal.user_id, str(record_id))
        check_version(record.version, version)
        existing = session.scalars(
            select(MemoryFact).where(
                MemoryFact.source_record_id == record.id,
                MemoryFact.source_record_version == version,
            )
        ).all()
        if existing:
            result = [memory_data(fact) for fact in existing]
        else:
            result = []
            for item in candidates:
                anchor = item["evidence_anchor"]
                fact = MemoryFact(
                    user_id=principal.user_id,
                    source_record_id=record.id,
                    source_record_version=version,
                    subject=item["subject"],
                    predicate=item["predicate"],
                    object_text=item["object_text"],
                    modality=item["modality"],
                    attribution=item["attribution"],
                    event_time=item["event_time"],
                    recorded_at=record.created_at,
                    evidence_start_char=anchor["start_char"],
                    evidence_end_char=anchor["end_char"],
                    evidence_excerpt=anchor["quote"],
                    status="candidate",
                    certainty=item["uncertainty"],
                    mock=item["mock"],
                )
                session.add(fact)
                session.flush()
                save_memory_version(session, fact, "extracted_candidate", "system")
                result.append(memory_data(fact))
            audit(
                session,
                principal.user_id,
                principal.device_id,
                "extract",
                "record",
                record.id,
                request.state.request_id,
            )
        session.commit()
        return envelope(request, {"items": result, "provider": settings.llm_provider})


@router.post("/queries")
def query(request: Request, payload: QueryInput, principal: Authenticated) -> dict[str, Any]:
    from app.query import query_records

    with Session(request.app.state.engine) as session:
        return envelope(request, query_records(session, principal.user_id, payload))

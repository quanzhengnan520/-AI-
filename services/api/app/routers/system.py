from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import SchemaState
from app.errors import APIError
from app.schemas import DemoData, DemoRecord, Envelope, HealthData, MetaData
from app.security import require_device

router = APIRouter()


@router.get("/health", response_model=Envelope[HealthData])
def health(request: Request) -> Envelope[HealthData]:
    try:
        with Session(request.app.state.engine) as session:
            milestone = session.scalar(select(SchemaState.milestone).where(SchemaState.id == 1))
        if milestone != "M0":
            raise APIError(503, "DATABASE_NOT_READY", "本地数据库未就绪，请先运行迁移。")
    except SQLAlchemyError as exc:
        raise APIError(503, "DATABASE_NOT_READY", "本地数据库未就绪，请先运行迁移。") from exc
    return Envelope(data=HealthData(), request_id=UUID(request.state.request_id))


@router.get("/api/v1/meta", response_model=Envelope[MetaData])
def meta(request: Request) -> Envelope[MetaData]:
    return Envelope(data=MetaData(), request_id=UUID(request.state.request_id))


@router.get(
    "/api/v1/demo", response_model=Envelope[DemoData], dependencies=[Depends(require_device)]
)
def demo(
    request: Request,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> Envelope[DemoData]:
    # All samples are synthetic and read-only; they are never inserted as user memory.
    records = [
        DemoRecord(
            id=UUID("c45a9a23-c736-4f56-9a1c-6cf475a48101"),
            title="演示 · 项目预算沟通",
            body_text="虚构的王总说：项目预算预计200万元，尚未正式审批。",
            captured_at="2026-10-15T06:00:00Z",
            timezone="Asia/Shanghai",
            version=1,
        ),
        DemoRecord(
            id=UUID("c45a9a23-c736-4f56-9a1c-6cf475a48102"),
            title="演示 · 预算后续沟通",
            body_text="虚构的王总说：目前只能考虑150万元，审批结果仍待确认。",
            captured_at="2026-11-12T07:30:00Z",
            timezone="Asia/Shanghai",
            version=1,
        ),
    ]
    return Envelope(
        data=DemoData(records=records[:limit]), request_id=UUID(request.state.request_id)
    )

"""Versioned API envelopes and explicitly synthetic sample resources."""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class Envelope[T](BaseModel):
    data: T
    request_id: UUID


class HealthData(BaseModel):
    status: Literal["ok"] = "ok"
    database: Literal["ok"] = "ok"


class MetaData(BaseModel):
    api_version: Literal["v1"] = "v1"
    milestone: Literal["M0", "M1"] = "M0"
    mode: Literal["mock", "live"] = "mock"
    label: str = "演示数据 · 不代表真实识别或分析结果"
    llm_provider: Literal["mock", "openai_compatible"] = "mock"
    asr_provider: Literal["mock"] = "mock"
    live_ai_enabled: bool = False
    llm_host: str | None = None


class DemoRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    title: str
    body_text: str
    captured_at: str
    timezone: str
    version: int
    mock: Literal[True] = True


class DemoData(BaseModel):
    mock: Literal[True] = True
    label: str = "演示内容 · 全部人物和项目均为虚构"
    records: list[DemoRecord]

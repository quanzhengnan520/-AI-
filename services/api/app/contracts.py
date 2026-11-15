"""M1 HTTP contracts. Evidence indices are Unicode code points, not UTF-16 offsets."""

from datetime import datetime
from typing import Annotated, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator

Name = Annotated[str, Field(min_length=1, max_length=100)]
Names = Annotated[list[Name], Field(max_length=20)]
ReviewStatus = Literal["candidate", "needs_review", "verified_by_user", "rejected", "superseded"]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)


class RecordCreate(Input):
    kind: Literal["text"] = "text"
    title: str = Field(min_length=1, max_length=200)
    body_text: str = Field(min_length=1, max_length=12000)
    captured_at: AwareDatetime
    timezone: str = "Asia/Shanghai"
    consent_confirmed: Literal[True]
    people: Names = Field(default_factory=list)
    projects: Names = Field(default_factory=list)
    events: Names = Field(default_factory=list)

    @field_validator("title", "body_text")
    @classmethod
    def not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Text must not be blank")
        return value

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise ValueError("Unknown timezone") from exc
        return value

    @field_validator("people", "projects", "events")
    @classmethod
    def unique_names(cls, value: list[str]) -> list[str]:
        if any(not item.strip() for item in value):
            raise ValueError("Entity names must not be blank")
        return sorted({item.strip() for item in value})


class RecordPatch(Input):
    expected_version: int = Field(ge=1)
    title: str | None = Field(default=None, min_length=1, max_length=200)
    body_text: str | None = Field(default=None, min_length=1, max_length=12000)
    captured_at: AwareDatetime | None = None
    timezone: str | None = None
    people: Names | None = None
    projects: Names | None = None
    events: Names | None = None

    @field_validator(
        "title",
        "body_text",
        "captured_at",
        "timezone",
        "people",
        "projects",
        "events",
        mode="before",
    )
    @classmethod
    def no_null(cls, value: object) -> object:
        if value is None:
            raise ValueError("Explicit null updates are not supported")
        if isinstance(value, str) and not value.strip():
            raise ValueError("Text must not be blank")
        return value

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value: str | None) -> str | None:
        return RecordCreate.valid_timezone(value) if value else value

    @field_validator("people", "projects", "events")
    @classmethod
    def unique_names(cls, value: list[str] | None) -> list[str] | None:
        return RecordCreate.unique_names(value) if value is not None else value


class ExtractInput(Input):
    expected_version: int | None = Field(default=None, ge=1)
    allow_live_ai: bool = False


class ReviewInput(Input):
    expected_version: int = Field(ge=1)
    review_action: Literal["verify", "reject", "correct"]
    corrected_object_text: str | None = Field(default=None, min_length=1, max_length=2000)
    review_note: str | None = Field(default=None, max_length=500)


class QueryFilters(Input):
    entity_names: Names = Field(default_factory=list)
    person: str | None = Field(default=None, max_length=100)
    project: str | None = Field(default=None, max_length=100)
    event: str | None = Field(default=None, max_length=100)
    confirmed_only: bool = False


class QueryInput(Input):
    question: str = Field(min_length=1, max_length=500)
    filters: QueryFilters = Field(default_factory=QueryFilters)
    include_uncertainty: bool = True


class PairInput(Input):
    pairing_code: str = Field(min_length=16, max_length=128)
    name: str = Field(min_length=1, max_length=80)
    platform: Literal["ios", "android", "web", "windows", "other"]


def utc(value: datetime) -> str:
    from datetime import UTC

    return value.astimezone(UTC).isoformat(timespec="microseconds").replace("+00:00", "Z")

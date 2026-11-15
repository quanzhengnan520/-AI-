"""A small synchronous SQLite boundary; no business data is created in M0."""

from collections.abc import Iterator
from pathlib import Path
from typing import Any

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column
from sqlalchemy.pool import StaticPool

from app.config import Settings


class Base(DeclarativeBase):
    pass


class SchemaState(Base):
    __tablename__ = "schema_state"

    id: Mapped[int] = mapped_column(primary_key=True)
    milestone: Mapped[str]
    created_at: Mapped[str]


def create_database(settings: Settings) -> Engine:
    url = settings.resolved_database_url
    if url != "sqlite:///:memory:":
        Path(url.removeprefix("sqlite:///")).parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(
        url,
        connect_args={"check_same_thread": False, "timeout": 5},
        **({"poolclass": StaticPool} if url == "sqlite:///:memory:" else {}),
    )

    @event.listens_for(engine, "connect")
    def configure_sqlite(connection: Any, _record: Any) -> None:
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()

    return engine


def sessions(engine: Engine) -> Iterator[Session]:
    with Session(engine) as session:
        yield session

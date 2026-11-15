from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text

from app.config import API_ROOT, Settings
from app.database import create_database


def test_migration_is_repeatable_and_creates_only_engineering_metadata(
    tmp_path: Path, monkeypatch
) -> None:
    database_url = "sqlite:///" + (tmp_path / "migration.db").as_posix()
    monkeypatch.setenv("DATABASE_URL", database_url)
    config = Config(str(API_ROOT / "alembic.ini"))
    command.upgrade(config, "0001_m0")
    command.upgrade(config, "0001_m0")
    settings = Settings(_env_file=None, database_url=database_url)
    engine = create_database(settings)
    try:
        assert set(inspect(engine).get_table_names()) == {"schema_state", "alembic_version"}
        with engine.connect() as connection:
            row = connection.execute(text("SELECT milestone, created_at FROM schema_state")).one()
            assert row.milestone == "M0"
            assert row.created_at.endswith("Z")
            assert connection.scalar(text("PRAGMA journal_mode")) == "wal"
    finally:
        engine.dispose()


def test_m1_additive_migration_roundtrip_preserves_m0_metadata(tmp_path: Path, monkeypatch) -> None:
    database_url = "sqlite:///" + (tmp_path / "m1-migration.db").as_posix()
    monkeypatch.setenv("DATABASE_URL", database_url)
    config = Config(str(API_ROOT / "alembic.ini"))
    command.upgrade(config, "0001_m0")
    engine = create_database(Settings(_env_file=None, database_url=database_url))
    try:
        with engine.connect() as connection:
            original_time = connection.scalar(text("SELECT created_at FROM schema_state"))
        command.upgrade(config, "head")
        assert {"source_records", "record_versions", "memory_facts", "devices"}.issubset(
            inspect(engine).get_table_names()
        )
        with engine.connect() as connection:
            assert connection.scalar(text("SELECT milestone FROM schema_state")) == "M1"
            assert connection.scalar(text("SELECT created_at FROM schema_state")) == original_time
        command.downgrade(config, "0001_m0")
        assert set(inspect(engine).get_table_names()) == {"schema_state", "alembic_version"}
        command.upgrade(config, "head")
        command.upgrade(config, "head")
        with engine.connect() as connection:
            assert connection.scalar(text("SELECT COUNT(*) FROM users")) == 1
    finally:
        engine.dispose()

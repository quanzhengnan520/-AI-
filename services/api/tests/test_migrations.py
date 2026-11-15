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
    command.upgrade(config, "head")
    command.upgrade(config, "head")
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

"""M1 frozen schema: text records, evidence memories and device authentication.

This revision deliberately imports no application models. Later model changes
must not alter the tables/columns created by an already published migration.
"""

from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

revision = "0002_m1"
down_revision = "0001_m0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "audit_events",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("actor", sa.String(), nullable=False),
        sa.Column("operation", sa.String(), nullable=False),
        sa.Column("target_type", sa.String(), nullable=False),
        sa.Column("target_id", sa.String(), nullable=False),
        sa.Column("request_id", sa.String(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_audit_events_user_id"), "audit_events", ["user_id"], unique=False)
    op.create_table(
        "model_usage",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("request_id", sa.String(), nullable=False),
        sa.Column("provider", sa.String(), nullable=False),
        sa.Column("model", sa.String(), nullable=False),
        sa.Column("task_type", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=True),
        sa.Column("output_tokens", sa.Integer(), nullable=True),
        sa.Column("estimate_cost", sa.String(), nullable=True),
        sa.Column("price_config_version", sa.String(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_model_usage_user_id"), "model_usage", ["user_id"], unique=False)
    op.create_table(
        "pairing_attempts",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("client_hash", sa.String(), nullable=False),
        sa.Column("attempted_at", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_pairing_attempts_attempted_at"), "pairing_attempts", ["attempted_at"], unique=False
    )
    op.create_index(
        op.f("ix_pairing_attempts_client_hash"), "pairing_attempts", ["client_hash"], unique=False
    )
    op.create_table(
        "users",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("locale", sa.String(), nullable=False),
        sa.Column("timezone", sa.String(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "devices",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("platform", sa.String(), nullable=False),
        sa.Column("token_hash", sa.String(), nullable=False),
        sa.Column("revoked_at", sa.String(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("last_seen_at", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index(op.f("ix_devices_user_id"), "devices", ["user_id"], unique=False)
    op.create_table(
        "entities",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("display_name", sa.String(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "kind", "display_name"),
    )
    op.create_index(op.f("ix_entities_user_id"), "entities", ["user_id"], unique=False)
    op.create_table(
        "pairing_codes",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("code_hash", sa.String(), nullable=False),
        sa.Column("expires_at", sa.String(), nullable=False),
        sa.Column("consumed_at", sa.String(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code_hash"),
    )
    op.create_table(
        "source_records",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("body_text", sa.String(), nullable=False),
        sa.Column("captured_at", sa.String(), nullable=False),
        sa.Column("timezone", sa.String(), nullable=False),
        sa.Column("consent_confirmed", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("retention_days", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.String(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("updated_at", sa.String(), nullable=False),
        sa.Column("deleted_at", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_record_timeline", "source_records", ["user_id", "captured_at", "id"], unique=False
    )
    op.create_index(
        op.f("ix_source_records_captured_at"), "source_records", ["captured_at"], unique=False
    )
    op.create_index(op.f("ix_source_records_user_id"), "source_records", ["user_id"], unique=False)
    op.create_table(
        "idempotency_entries",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("payload_hash", sa.String(), nullable=False),
        sa.Column("record_id", sa.String(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(
            ["record_id"],
            ["source_records.id"],
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "key"),
    )
    op.create_table(
        "memory_facts",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("source_record_id", sa.String(), nullable=False),
        sa.Column("source_record_version", sa.Integer(), nullable=False),
        sa.Column("subject", sa.String(), nullable=False),
        sa.Column("predicate", sa.String(), nullable=False),
        sa.Column("object_text", sa.String(), nullable=False),
        sa.Column("modality", sa.String(), nullable=False),
        sa.Column("attribution", sa.String(), nullable=True),
        sa.Column("event_time", sa.String(), nullable=True),
        sa.Column("recorded_at", sa.String(), nullable=False),
        sa.Column("evidence_start_char", sa.Integer(), nullable=False),
        sa.Column("evidence_end_char", sa.Integer(), nullable=False),
        sa.Column("evidence_excerpt", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("certainty", sa.String(), nullable=False),
        sa.Column("mock", sa.Boolean(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("updated_at", sa.String(), nullable=False),
        sa.Column("deleted_at", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(
            ["source_record_id"],
            ["source_records.id"],
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "source_record_id", "source_record_version", "evidence_start_char", "evidence_end_char"
        ),
    )
    op.create_index(
        op.f("ix_memory_facts_source_record_id"), "memory_facts", ["source_record_id"], unique=False
    )
    op.create_index(op.f("ix_memory_facts_status"), "memory_facts", ["status"], unique=False)
    op.create_index(op.f("ix_memory_facts_user_id"), "memory_facts", ["user_id"], unique=False)
    op.create_table(
        "record_entities",
        sa.Column("record_id", sa.String(), nullable=False),
        sa.Column("entity_id", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(
            ["entity_id"],
            ["entities.id"],
        ),
        sa.ForeignKeyConstraint(
            ["record_id"],
            ["source_records.id"],
        ),
        sa.PrimaryKeyConstraint("record_id", "entity_id"),
    )
    op.create_table(
        "record_versions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("record_id", sa.String(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("snapshot_json", sa.String(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(
            ["record_id"],
            ["source_records.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("record_id", "version"),
    )
    op.create_index(
        op.f("ix_record_versions_record_id"), "record_versions", ["record_id"], unique=False
    )
    op.create_table(
        "memory_versions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("fact_id", sa.String(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("snapshot_json", sa.String(), nullable=False),
        sa.Column("reason", sa.String(), nullable=False),
        sa.Column("changed_by", sa.String(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(
            ["fact_id"],
            ["memory_facts.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_memory_versions_fact_id"), "memory_versions", ["fact_id"], unique=False
    )
    users = sa.table(
        "users",
        sa.column("id", sa.String),
        sa.column("locale", sa.String),
        sa.column("timezone", sa.String),
        sa.column("created_at", sa.String),
    )
    op.bulk_insert(
        users,
        [
            {
                "id": "e5f9ac84-f8c2-41f6-8643-5ac0c00a1001",
                "locale": "zh-CN",
                "timezone": "Asia/Shanghai",
                "created_at": datetime.now(UTC)
                .isoformat(timespec="microseconds")
                .replace("+00:00", "Z"),
            }
        ],
    )
    op.execute(sa.text("UPDATE schema_state SET milestone='M1' WHERE id=1"))


def downgrade() -> None:
    op.drop_index(op.f("ix_memory_versions_fact_id"), table_name="memory_versions")
    op.drop_table("memory_versions")
    op.drop_index(op.f("ix_record_versions_record_id"), table_name="record_versions")
    op.drop_table("record_versions")
    op.drop_table("record_entities")
    op.drop_index(op.f("ix_memory_facts_user_id"), table_name="memory_facts")
    op.drop_index(op.f("ix_memory_facts_status"), table_name="memory_facts")
    op.drop_index(op.f("ix_memory_facts_source_record_id"), table_name="memory_facts")
    op.drop_table("memory_facts")
    op.drop_table("idempotency_entries")
    op.drop_index(op.f("ix_source_records_user_id"), table_name="source_records")
    op.drop_index(op.f("ix_source_records_captured_at"), table_name="source_records")
    op.drop_index("ix_record_timeline", table_name="source_records")
    op.drop_table("source_records")
    op.drop_table("pairing_codes")
    op.drop_index(op.f("ix_entities_user_id"), table_name="entities")
    op.drop_table("entities")
    op.drop_index(op.f("ix_devices_user_id"), table_name="devices")
    op.drop_table("devices")
    op.drop_table("users")
    op.drop_index(op.f("ix_pairing_attempts_client_hash"), table_name="pairing_attempts")
    op.drop_index(op.f("ix_pairing_attempts_attempted_at"), table_name="pairing_attempts")
    op.drop_table("pairing_attempts")
    op.drop_index(op.f("ix_model_usage_user_id"), table_name="model_usage")
    op.drop_table("model_usage")
    op.drop_index(op.f("ix_audit_events_user_id"), table_name="audit_events")
    op.drop_table("audit_events")
    op.execute(sa.text("UPDATE schema_state SET milestone='M0' WHERE id=1"))

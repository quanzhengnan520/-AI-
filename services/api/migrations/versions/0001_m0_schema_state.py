"""M0 engineering metadata only; no private records, tokens or memory facts."""

from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

revision = "0001_m0"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    table = op.create_table(
        "schema_state",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("milestone", sa.String, nullable=False),
        sa.Column("created_at", sa.String, nullable=False),
    )
    op.bulk_insert(
        table,
        [
            {
                "id": 1,
                "milestone": "M0",
                "created_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            }
        ],
    )


def downgrade() -> None:
    op.drop_table("schema_state")

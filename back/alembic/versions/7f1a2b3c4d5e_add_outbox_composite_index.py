"""add outbox composite index

Revision ID: 7f1a2b3c4d5e
Revises: 6c0d8a3c1f2b
Create Date: 2026-02-03 00:00:00.000000

"""

from alembic import op


revision = "7f1a2b3c4d5e"
down_revision = "6c0d8a3c1f2b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Optimise la requête: WHERE processed_at IS NULL AND locked_at IS NULL ORDER BY id ASC
    # (le planner profite du prefix processed_at/locked_at, puis id pour l'ordre)
    op.create_index(
        "ix_outbox_message_processed_locked_id",
        "outbox_message",
        ["processed_at", "locked_at", "id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_outbox_message_processed_locked_id", table_name="outbox_message")


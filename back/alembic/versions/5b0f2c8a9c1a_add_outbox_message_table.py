"""add outbox_message table

Revision ID: 5b0f2c8a9c1a
Revises: 9a380629b882
Create Date: 2026-02-03 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "5b0f2c8a9c1a"
down_revision = "9a380629b882"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "outbox_message",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("event_name", sa.String(length=120), nullable=False),
        sa.Column("aggregate_type", sa.String(length=80), nullable=False),
        sa.Column("aggregate_id", sa.BigInteger(), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.Column("processed_at", sa.BigInteger(), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(op.f("ix_outbox_message_id"), "outbox_message", ["id"], unique=False)
    op.create_index(op.f("ix_outbox_message_event_name"), "outbox_message", ["event_name"], unique=False)
    op.create_index(op.f("ix_outbox_message_aggregate_type"), "outbox_message", ["aggregate_type"], unique=False)
    op.create_index(op.f("ix_outbox_message_aggregate_id"), "outbox_message", ["aggregate_id"], unique=False)
    op.create_index(op.f("ix_outbox_message_created_at"), "outbox_message", ["created_at"], unique=False)
    op.create_index(op.f("ix_outbox_message_processed_at"), "outbox_message", ["processed_at"], unique=False)
    op.create_index(op.f("ix_outbox_message_attempts"), "outbox_message", ["attempts"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_outbox_message_attempts"), table_name="outbox_message")
    op.drop_index(op.f("ix_outbox_message_processed_at"), table_name="outbox_message")
    op.drop_index(op.f("ix_outbox_message_created_at"), table_name="outbox_message")
    op.drop_index(op.f("ix_outbox_message_aggregate_id"), table_name="outbox_message")
    op.drop_index(op.f("ix_outbox_message_aggregate_type"), table_name="outbox_message")
    op.drop_index(op.f("ix_outbox_message_event_name"), table_name="outbox_message")
    op.drop_index(op.f("ix_outbox_message_id"), table_name="outbox_message")
    op.drop_table("outbox_message")


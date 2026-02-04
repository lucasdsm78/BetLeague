"""add outbox locking columns

Revision ID: 6c0d8a3c1f2b
Revises: 5b0f2c8a9c1a
Create Date: 2026-02-03 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


revision = "6c0d8a3c1f2b"
down_revision = "5b0f2c8a9c1a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("outbox_message", sa.Column("locked_at", sa.BigInteger(), nullable=True))
    op.add_column("outbox_message", sa.Column("locked_by", sa.String(length=80), nullable=True))

    op.create_index(op.f("ix_outbox_message_locked_at"), "outbox_message", ["locked_at"], unique=False)
    op.create_index(op.f("ix_outbox_message_locked_by"), "outbox_message", ["locked_by"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_outbox_message_locked_by"), table_name="outbox_message")
    op.drop_index(op.f("ix_outbox_message_locked_at"), table_name="outbox_message")

    op.drop_column("outbox_message", "locked_by")
    op.drop_column("outbox_message", "locked_at")


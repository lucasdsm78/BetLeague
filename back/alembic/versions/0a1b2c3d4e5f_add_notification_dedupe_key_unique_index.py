"""add notification dedupe key unique index

Revision ID: 0a1b2c3d4e5f
Revises: fd5e6f7a8b9c
Create Date: 2026-05-08 18:30:00.000000

"""

from alembic import op
import sqlalchemy as sa


revision = "0a1b2c3d4e5f"
down_revision = "fd5e6f7a8b9c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("notification", sa.Column("dedupe_key", sa.String(length=200), nullable=True))
    op.create_index(
        "uq_notification_user_type_dedupe_key",
        "notification",
        ["user_id", "type", "dedupe_key"],
        unique=True,
        postgresql_where=sa.text("dedupe_key IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_notification_user_type_dedupe_key", table_name="notification")
    op.drop_column("notification", "dedupe_key")


"""create notification table

Revision ID: 33b2b301c7d1
Revises: bbc69ef68eaf
Create Date: 2026-02-02 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "33b2b301c7d1"
down_revision = "bbc69ef68eaf"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notification",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("type", sa.String(length=80), nullable=False),
        sa.Column("title", sa.String(length=150), nullable=False),
        sa.Column("message", sa.String(length=600), nullable=False),
        sa.Column("data", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.Column("read_at", sa.BigInteger(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notification_id"), "notification", ["id"], unique=False)
    op.create_index(op.f("ix_notification_user_id"), "notification", ["user_id"], unique=False)
    op.create_index(op.f("ix_notification_created_at"), "notification", ["created_at"], unique=False)
    op.create_index(op.f("ix_notification_read_at"), "notification", ["read_at"], unique=False)
    op.create_index(op.f("ix_notification_type"), "notification", ["type"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_notification_type"), table_name="notification")
    op.drop_index(op.f("ix_notification_read_at"), table_name="notification")
    op.drop_index(op.f("ix_notification_created_at"), table_name="notification")
    op.drop_index(op.f("ix_notification_user_id"), table_name="notification")
    op.drop_index(op.f("ix_notification_id"), table_name="notification")
    op.drop_table("notification")


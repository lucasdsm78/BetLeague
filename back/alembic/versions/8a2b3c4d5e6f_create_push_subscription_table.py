"""create push_subscription table

Revision ID: 8a2b3c4d5e6f
Revises: 7f1a2b3c4d5e
Create Date: 2026-02-04 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "8a2b3c4d5e6f"
down_revision = "7f1a2b3c4d5e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "push_subscription",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("endpoint", sa.Text(), nullable=False),
        sa.Column("p256dh_key", sa.String(length=255), nullable=False),
        sa.Column("auth_key", sa.String(length=64), nullable=False),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.Column("last_used_at", sa.BigInteger(), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["user.id"],
            name="fk_push_subscription_user_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("endpoint", name="uq_push_subscription_endpoint"),
    )

    op.create_index(
        op.f("ix_push_subscription_user_id"),
        "push_subscription",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_push_subscription_created_at"),
        "push_subscription",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        "ix_push_subscription_user_created",
        "push_subscription",
        ["user_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_push_subscription_user_created", table_name="push_subscription")
    op.drop_index(op.f("ix_push_subscription_created_at"), table_name="push_subscription")
    op.drop_index(op.f("ix_push_subscription_user_id"), table_name="push_subscription")
    op.drop_table("push_subscription")

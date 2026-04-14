"""add followup query indexes

Revision ID: fa2b3c4d5e6f
Revises: f9a1b2c3d4e5
Create Date: 2026-04-10 00:30:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "fa2b3c4d5e6f"
down_revision = "f9a1b2c3d4e5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_invitation_user_created_at",
        "invitation",
        ["user_id", "created_at", "id"],
        unique=False,
    )
    op.create_index(
        "ix_invitation_user_status_created_at",
        "invitation",
        ["user_id", "status", "created_at", "id"],
        unique=False,
    )
    op.create_index(
        "ix_league_user_created_at",
        "league",
        ["user_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_tournament_user_created_at",
        "tournament",
        ["user_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_outbox_message_stale_locked_at",
        "outbox_message",
        ["locked_at"],
        unique=False,
        postgresql_where=sa.text("processed_at IS NULL AND locked_at IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_outbox_message_stale_locked_at", table_name="outbox_message")
    op.drop_index("ix_tournament_user_created_at", table_name="tournament")
    op.drop_index("ix_league_user_created_at", table_name="league")
    op.drop_index("ix_invitation_user_status_created_at", table_name="invitation")
    op.drop_index("ix_invitation_user_created_at", table_name="invitation")


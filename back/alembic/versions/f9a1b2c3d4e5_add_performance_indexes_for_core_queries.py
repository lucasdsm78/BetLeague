"""add performance indexes for core queries

Revision ID: f9a1b2c3d4e5
Revises: c8d9e0f1a2b3
Create Date: 2026-04-10 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f9a1b2c3d4e5"
down_revision = "c8d9e0f1a2b3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_ticket_user_status_league_id_id",
        "ticket",
        ["user_id", "status", "league_id", "id"],
        unique=False,
    )
    op.create_index(
        "ix_ticket_user_tournament_match",
        "ticket",
        ["user_id", "tournament_match_id"],
        unique=False,
    )

    op.create_index(
        "ix_notification_user_created_id",
        "notification",
        ["user_id", "created_at", "id"],
        unique=False,
    )
    op.create_index(
        "ix_notification_user_unread",
        "notification",
        ["user_id"],
        unique=False,
        postgresql_where=sa.text("read_at IS NULL"),
    )

    op.create_index(
        "ix_leagues_players_league_btl_rank",
        "leagues_players",
        ["league_id", "btl_from_tickets", "user_id"],
        unique=False,
    )

    op.create_index(
        "ix_match_time",
        "match",
        ["time"],
        unique=False,
    )

    op.create_index(
        "ix_user_pseudo_active",
        "user",
        ["pseudo"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    op.create_index(
        "ix_tournament_stage_due_active",
        "tournament_stage",
        ["tournament_id", "end_date", "start_date", "id"],
        unique=False,
        postgresql_where=sa.text("is_active = true AND is_completed = false"),
    )

    op.create_index(
        "ix_tournament_player_tournament_stage_eliminated",
        "tournament_player",
        ["tournament_id", "stage", "is_eliminated", "id"],
        unique=False,
    )

    op.create_index(
        "ix_tournament_match_tournament_type",
        "tournament_match",
        ["tournament_id", "type"],
        unique=False,
    )

    op.create_index(
        "ix_tournament_subscription_user_status",
        "tournament_subscription",
        ["user_id", "status"],
        unique=False,
    )

    op.create_index(
        "ix_purchase_user_created_id",
        "purchase",
        ["user_id", "created_at", "id"],
        unique=False,
    )

def downgrade() -> None:
    op.drop_index("ix_purchase_user_created_id", table_name="purchase")
    op.drop_index("ix_tournament_subscription_user_status", table_name="tournament_subscription")
    op.drop_index("ix_tournament_match_tournament_type", table_name="tournament_match")
    op.drop_index("ix_tournament_player_tournament_stage_eliminated", table_name="tournament_player")
    op.drop_index("ix_tournament_stage_due_active", table_name="tournament_stage")
    op.drop_index("ix_user_pseudo_active", table_name="user")
    op.drop_index("ix_match_time", table_name="match")
    op.drop_index("ix_leagues_players_league_btl_rank", table_name="leagues_players")
    op.drop_index("ix_notification_user_unread", table_name="notification")
    op.drop_index("ix_notification_user_created_id", table_name="notification")
    op.drop_index("ix_ticket_user_tournament_match", table_name="ticket")
    op.drop_index("ix_ticket_user_status_league_id_id", table_name="ticket")





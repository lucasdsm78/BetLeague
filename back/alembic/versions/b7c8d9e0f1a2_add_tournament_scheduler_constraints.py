"""add tournament scheduler constraints

Revision ID: b7c8d9e0f1a2
Revises: a7b8c9d0e1f2
Create Date: 2026-04-05 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b7c8d9e0f1a2"
down_revision = "a7b8c9d0e1f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_tournament_player_tournament_user",
        "tournament_player",
        ["tournament_id", "user_id"],
    )
    op.create_unique_constraint(
        "uq_tournament_stage_tournament_type",
        "tournament_stage",
        ["tournament_id", "type"],
    )
    op.create_index(
        "uq_tournament_stage_single_active_per_tournament",
        "tournament_stage",
        ["tournament_id"],
        unique=True,
        postgresql_where=sa.text("is_active = true"),
    )
    op.create_unique_constraint(
        "uq_tournament_match_stage_players",
        "tournament_match",
        ["stage_id", "player1_id", "player2_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_tournament_match_stage_players",
        "tournament_match",
        type_="unique",
    )
    op.drop_index(
        "uq_tournament_stage_single_active_per_tournament",
        table_name="tournament_stage",
    )
    op.drop_constraint(
        "uq_tournament_stage_tournament_type",
        "tournament_stage",
        type_="unique",
    )
    op.drop_constraint(
        "uq_tournament_player_tournament_user",
        "tournament_player",
        type_="unique",
    )


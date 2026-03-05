"""Add composite index leagues_players(user_id, league_id)

Revision ID: 2a7c8d9e0f1a
Revises: 1f2e3d4c5b6a
Create Date: 2026-03-05

"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "2a7c8d9e0f1a"
down_revision = "1f2e3d4c5b6a"
branch_labels = None
depends_on = None


_INDEX_NAME = "ix_leagues_players_user_id_league_id"
_TABLE_NAME = "leagues_players"


def upgrade() -> None:
    # La contrainte unique (uq_leagues_players_user_league) implique déjà
    # un index sous-jacent, et on a aussi historiquement l'index
    # idx_user_league_league_players.
    #
    # Objectif ici: garantir la présence explicite de l'index composite pour
    # les requêtes (user_id, league_id) quel que soit l'historique.

    bind = op.get_bind()
    if not bind.dialect.has_index(bind, _TABLE_NAME, _INDEX_NAME):
        op.create_index(
            _INDEX_NAME,
            _TABLE_NAME,
            ["user_id", "league_id"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.has_index(bind, _TABLE_NAME, _INDEX_NAME):
        op.drop_index(_INDEX_NAME, table_name=_TABLE_NAME)

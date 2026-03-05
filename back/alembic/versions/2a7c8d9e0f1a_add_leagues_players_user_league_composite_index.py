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


def upgrade() -> None:
    # La contrainte unique (uq_leagues_players_user_league) implique déjà
    # un index sous-jacent, et on a aussi historiquement l'index
    # idx_user_league_league_players.
    #
    # Objectif ici: garantir la présence explicite de l'index composite pour
    # les requêtes (user_id, league_id) quel que soit l'historique.
    # On utilise checkfirst=True pour éviter les erreurs si l'index existe.

    op.create_index(
        "ix_leagues_players_user_id_league_id",
        "leagues_players",
        ["user_id", "league_id"],
        unique=False,
        postgresql_concurrently=False,
        if_not_exists=True,
    )


def downgrade() -> None:
    # On ne drop pas l'index historique; on retire uniquement celui ajouté.
    op.drop_index(
        "ix_leagues_players_user_id_league_id",
        table_name="leagues_players",
        if_exists=True,
    )


"""Drop redundant composite index on leagues_players

Revision ID: 3b1c2d3e4f5a
Revises: 2a7c8d9e0f1a
Create Date: 2026-03-05

"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "3b1c2d3e4f5a"
down_revision = "2a7c8d9e0f1a"
branch_labels = None
depends_on = None


_TABLE_NAME = "leagues_players"
_REDUNDANT_INDEX = "idx_user_league_league_players"


def upgrade() -> None:
    # Cet index est redondant car on a déjà:
    # - la contrainte unique uq_leagues_players_user_league (index btree)
    # - l'index ix_leagues_players_user_id_league_id (index btree)
    #
    # On le supprime pour réduire les coûts d'écriture (INSERT/UPDATE) et la taille disque.
    bind = op.get_bind()
    if bind.dialect.has_index(bind, _TABLE_NAME, _REDUNDANT_INDEX):
        op.drop_index(_REDUNDANT_INDEX, table_name=_TABLE_NAME)


def downgrade() -> None:
    # On restaure l'index historique en cas de rollback.
    bind = op.get_bind()
    if not bind.dialect.has_index(bind, _TABLE_NAME, _REDUNDANT_INDEX):
        op.create_index(_REDUNDANT_INDEX, _TABLE_NAME, ["user_id", "league_id"], unique=False)


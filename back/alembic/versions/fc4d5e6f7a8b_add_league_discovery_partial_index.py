"""add league discovery partial index

Revision ID: fc4d5e6f7a8b
Revises: fb3c4d5e6f7a
Create Date: 2026-04-14 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "fc4d5e6f7a8b"
down_revision = "fb3c4d5e6f7a"
branch_labels = None
depends_on = None


INDEX_NAME = "ix_league_public_open_joinable_created_at_desc"
TABLE_NAME = "league"


def upgrade() -> None:
    op.create_index(
        INDEX_NAME,
        TABLE_NAME,
        [sa.text("created_at DESC"), sa.text("id DESC")],
        unique=False,
        postgresql_where=sa.text("is_private = false AND status = 'OPEN' AND nb_players_remaining > 0"),
    )


def downgrade() -> None:
    op.drop_index(INDEX_NAME, table_name=TABLE_NAME)


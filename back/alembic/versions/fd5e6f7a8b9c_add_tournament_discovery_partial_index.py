"""add tournament discovery partial index

Revision ID: fd5e6f7a8b9c
Revises: fc4d5e6f7a8b
Create Date: 2026-04-14 00:05:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "fd5e6f7a8b9c"
down_revision = "fc4d5e6f7a8b"
branch_labels = None
depends_on = None


INDEX_NAME = "ix_tournament_public_pending_joinable_created_at_desc"
TABLE_NAME = "tournament"


def upgrade() -> None:
	op.create_index(
		INDEX_NAME,
		TABLE_NAME,
		[sa.text("created_at DESC"), sa.text("id DESC")],
		unique=False,
		postgresql_where=sa.text("is_private = false AND status = 'pending' AND current_players < max_players"),
	)


def downgrade() -> None:
	op.drop_index(INDEX_NAME, table_name=TABLE_NAME)


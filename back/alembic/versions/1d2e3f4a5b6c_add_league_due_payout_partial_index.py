"""add league due payout partial index

Revision ID: 1d2e3f4a5b6c
Revises: 0a1b2c3d4e5f
Create Date: 2026-05-09 11:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


revision = "1d2e3f4a5b6c"
down_revision = "0a1b2c3d4e5f"
branch_labels = None
depends_on = None


INDEX_NAME = "ix_league_due_payout"
TABLE_NAME = "league"


def upgrade() -> None:
    op.create_index(
        INDEX_NAME,
        TABLE_NAME,
        ["end_date"],
        unique=False,
        postgresql_where=sa.text("status = 'IN_PROGRESS' AND closed_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index(INDEX_NAME, table_name=TABLE_NAME)


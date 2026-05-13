"""add league min_players column

Revision ID: 2f4b6c8d9e1a
Revises: 1d2e3f4a5b6c
Create Date: 2026-05-13 01:05:00.000000

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '2f4b6c8d9e1a'
down_revision = '1d2e3f4a5b6c'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = {column['name'] for column in inspector.get_columns('league')}

    if 'min_players' not in columns:
        op.add_column('league', sa.Column('min_players', sa.Integer(), nullable=True))

    op.execute(sa.text('UPDATE league SET min_players = max_players WHERE min_players IS NULL'))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = {column['name'] for column in inspector.get_columns('league')}

    if 'min_players' in columns:
        op.drop_column('league', 'min_players')


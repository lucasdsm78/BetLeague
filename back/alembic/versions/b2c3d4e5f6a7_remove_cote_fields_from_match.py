"""remove_cote_fields_from_match

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-01 00:01:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column('match', 'cote_home')
    op.drop_column('match', 'cote_draw')
    op.drop_column('match', 'cote_away')


def downgrade() -> None:
    op.add_column('match', sa.Column('cote_away', sa.Float(), nullable=False, server_default='0.0'))
    op.add_column('match', sa.Column('cote_draw', sa.Float(), nullable=False, server_default='0.0'))
    op.add_column('match', sa.Column('cote_home', sa.Float(), nullable=False, server_default='0.0'))

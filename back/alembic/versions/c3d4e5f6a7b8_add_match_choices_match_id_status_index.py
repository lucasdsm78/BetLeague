"""add_match_choices_match_id_status_index

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-03-02 00:00:00.000000

"""

from alembic import op


# revision identifiers, used by Alembic.
revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        'ix_match_choices_match_id_status',
        'match_choices',
        ['match_id', 'status'],
    )


def downgrade() -> None:
    op.drop_index('ix_match_choices_match_id_status', table_name='match_choices')

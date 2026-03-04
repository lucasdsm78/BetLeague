"""add_match_odds_table

Revision ID: a1b2c3d4e5f6
Revises: 4c355215b337
Create Date: 2026-03-01 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '4c355215b337'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create match_odds table
    op.create_table(
        'match_odds',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('match_id', sa.Integer(), nullable=False),
        sa.Column('bet_type', sa.String(), nullable=False),
        sa.Column('bet_name', sa.String(), nullable=False),
        sa.Column('value', sa.String(), nullable=False),
        sa.Column('odd', sa.Float(), nullable=False),
        sa.Column('result', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['match_id'], ['match.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_match_odds_match_id_bet_type', 'match_odds', ['match_id', 'bet_type'], unique=False)

    # Add match_odd_id to match_choices (nullable, references match_odds)
    op.add_column(
        'match_choices',
        sa.Column('match_odd_id', sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        'fk_match_choices_match_odd_id',
        'match_choices', 'match_odds',
        ['match_odd_id'], ['id'],
        ondelete='SET NULL',
    )
    op.create_index('ix_match_choices_match_odd_id', 'match_choices', ['match_odd_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_match_choices_match_odd_id', table_name='match_choices')
    op.drop_constraint('fk_match_choices_match_odd_id', 'match_choices', type_='foreignkey')
    op.drop_column('match_choices', 'match_odd_id')

    op.drop_index('ix_match_odds_match_id_bet_type', table_name='match_odds')
    op.drop_table('match_odds')

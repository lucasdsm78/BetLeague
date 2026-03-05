"""Make leagues_players user_id/league_id NOT NULL and unique

Revision ID: 1f2e3d4c5b6a
Revises: c15673da3deb
Create Date: 2026-03-05

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '1f2e3d4c5b6a'
down_revision = 'c15673da3deb'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop old non-unique composite index if it exists
    op.drop_index('idx_user_league_league_players', table_name='leagues_players')

    # Enforce NOT NULL (data should already be valid; if not, migration will fail fast)
    op.alter_column('leagues_players', 'user_id', existing_type=sa.Integer(), nullable=False)
    op.alter_column('leagues_players', 'league_id', existing_type=sa.Integer(), nullable=False)

    # Add unique constraint as source of truth for idempotence and concurrency safety
    op.create_unique_constraint('uq_leagues_players_user_league', 'leagues_players', ['user_id', 'league_id'])

    # Keep useful indexes for query patterns
    op.create_index('idx_user_league_league_players', 'leagues_players', ['user_id', 'league_id'], unique=False)


def downgrade() -> None:
    op.drop_index('idx_user_league_league_players', table_name='leagues_players')
    op.drop_constraint('uq_leagues_players_user_league', 'leagues_players', type_='unique')
    op.alter_column('leagues_players', 'league_id', existing_type=sa.Integer(), nullable=True)
    op.alter_column('leagues_players', 'user_id', existing_type=sa.Integer(), nullable=True)
    op.create_index('idx_user_league_league_players', 'leagues_players', ['user_id', 'league_id'], unique=False)


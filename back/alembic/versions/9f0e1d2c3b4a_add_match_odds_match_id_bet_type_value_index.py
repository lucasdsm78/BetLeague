"""add_match_odds_match_id_bet_type_value_index

Revision ID: 9f0e1d2c3b4a
Revises: a1b2c3d4e5f6
Create Date: 2026-03-05 00:00:00.000000

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = '9f0e1d2c3b4a'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Accélère les lectures par match_id et l'extraction 1X2 (bet_type + value)
    # Utile pour /api/matches: WHERE match_id IN (...) ORDER BY match_id, bet_type, value
    op.create_index(
        'ix_match_odds_match_id_bet_type_value',
        'match_odds',
        ['match_id', 'bet_type', 'value'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_match_odds_match_id_bet_type_value', table_name='match_odds')


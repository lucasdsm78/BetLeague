"""add_unique_match_odds_match_id_bet_type_value

Revision ID: 0c1d2e3f4a5b
Revises: 9f0e1d2c3b4a
Create Date: 2026-03-05 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0c1d2e3f4a5b'
down_revision = '9f0e1d2c3b4a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Avant d'ajouter la contrainte, on supprime d'éventuels doublons existants.
    # On conserve l'odd la plus récente (id max) pour chaque (match_id, bet_type, value).
    conn = op.get_bind()

    dup_rows = conn.execute(sa.text(
        """
        SELECT match_id, bet_type, value, array_agg(id ORDER BY id DESC) AS ids
        FROM match_odds
        GROUP BY match_id, bet_type, value
        HAVING count(*) > 1
        """
    )).fetchall()

    for match_id, bet_type, value, ids in dup_rows:
        # ids est une liste/array, triée DESC => ids[0] est à garder
        ids_to_delete = list(ids)[1:]
        if ids_to_delete:
            conn.execute(
                sa.text("DELETE FROM match_odds WHERE id = ANY(:ids)").bindparams(
                    sa.bindparam("ids", ids_to_delete, expanding=True)
                )
            )

    op.create_unique_constraint(
        'uq_match_odds_match_id_bet_type_value',
        'match_odds',
        ['match_id', 'bet_type', 'value'],
    )


def downgrade() -> None:
    op.drop_constraint('uq_match_odds_match_id_bet_type_value', 'match_odds', type_='unique')


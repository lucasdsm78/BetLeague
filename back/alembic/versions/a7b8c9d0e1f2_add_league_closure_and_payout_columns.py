"""add league closure and payout columns

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-04-04 11:30:00.000000

"""

from alembic import op
import sqlalchemy as sa


revision = "a7b8c9d0e1f2"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


LEAGUE_STATUS_OPEN = "OPEN"
LEAGUE_STATUS_IN_PROGRESS = "IN_PROGRESS"
LEAGUE_STATUS_CLOSED = "CLOSED"


def upgrade() -> None:
    op.add_column("league", sa.Column("status", sa.String(), nullable=True))
    op.add_column("league", sa.Column("closed_at", sa.BigInteger(), nullable=True))
    op.add_column("league", sa.Column("reward_paid_at", sa.BigInteger(), nullable=True))
    op.add_column("league", sa.Column("rewarded_amount", sa.Float(), nullable=True))

    op.execute(
        sa.text(
            f"""
            UPDATE league
            SET status = CASE
                WHEN winner_id IS NOT NULL THEN '{LEAGUE_STATUS_CLOSED}'
                WHEN is_started = TRUE THEN '{LEAGUE_STATUS_IN_PROGRESS}'
                ELSE '{LEAGUE_STATUS_OPEN}'
            END
            """
        )
    )

    op.execute(
        sa.text(
            """
            UPDATE league
            SET closed_at = updated_at,
                reward_paid_at = updated_at,
                rewarded_amount = CASE
                    WHEN is_free = TRUE THEN 200
                    ELSE COALESCE(nb_btl, 0) * (
                        SELECT COUNT(*)
                        FROM leagues_players lp
                        WHERE lp.league_id = league.id
                    )
                END
            WHERE winner_id IS NOT NULL
            """
        )
    )

    op.alter_column("league", "status", nullable=False, server_default=LEAGUE_STATUS_OPEN)
    op.create_index("ix_league_status_end_date", "league", ["status", "end_date"], unique=False)
    op.create_index(op.f("ix_league_closed_at"), "league", ["closed_at"], unique=False)
    op.create_index(op.f("ix_league_reward_paid_at"), "league", ["reward_paid_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_league_reward_paid_at"), table_name="league")
    op.drop_index(op.f("ix_league_closed_at"), table_name="league")
    op.drop_index("ix_league_status_end_date", table_name="league")
    op.drop_column("league", "rewarded_amount")
    op.drop_column("league", "reward_paid_at")
    op.drop_column("league", "closed_at")
    op.drop_column("league", "status")


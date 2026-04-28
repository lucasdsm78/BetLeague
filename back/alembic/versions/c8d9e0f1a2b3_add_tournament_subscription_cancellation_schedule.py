"""add tournament subscription cancellation schedule

Revision ID: c8d9e0f1a2b3
Revises: b7c8d9e0f1a2
Create Date: 2026-04-05 18:10:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c8d9e0f1a2b3'
down_revision = 'b7c8d9e0f1a2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'tournament_subscription',
        sa.Column('cancel_at_period_end', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        'tournament_subscription',
        sa.Column('cancellation_requested_at', sa.BigInteger(), nullable=True),
    )
    op.alter_column('tournament_subscription', 'cancel_at_period_end', server_default=None)
    op.create_index(
        'ix_tournament_subscription_cancel_at_period_end',
        'tournament_subscription',
        ['cancel_at_period_end'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_tournament_subscription_cancel_at_period_end', table_name='tournament_subscription')
    op.drop_column('tournament_subscription', 'cancellation_requested_at')
    op.drop_column('tournament_subscription', 'cancel_at_period_end')


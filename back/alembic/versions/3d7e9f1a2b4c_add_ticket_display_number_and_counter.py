"""add ticket display number and per-user counter

Revision ID: 3d7e9f1a2b4c
Revises: 2f4b6c8d9e1a
Create Date: 2026-05-14 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = '3d7e9f1a2b4c'
down_revision: Union[str, None] = '2f4b6c8d9e1a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    table_names = set(inspector.get_table_names())

    if 'user_ticket_counter' not in table_names:
        op.create_table(
            'user_ticket_counter',
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('user.id'), primary_key=True, nullable=False),
            sa.Column('next_value', sa.Integer(), nullable=False),
        )

    ticket_columns = {column['name'] for column in inspector.get_columns('ticket')}
    if 'display_number' not in ticket_columns:
        op.add_column('ticket', sa.Column('display_number', sa.Integer(), nullable=True))

    op.execute(sa.text("""
        WITH numbered_tickets AS (
            SELECT
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY user_id
                    ORDER BY created_at ASC, id ASC
                ) AS display_number
            FROM ticket
        )
        UPDATE ticket
        SET display_number = numbered_tickets.display_number
        FROM numbered_tickets
        WHERE ticket.id = numbered_tickets.id
          AND ticket.display_number IS NULL
    """))

    unique_constraints = {
        constraint['name']
        for constraint in inspector.get_unique_constraints('ticket')
        if constraint.get('name')
    }
    if 'uq_ticket_user_display_number' not in unique_constraints:
        op.create_unique_constraint(
            'uq_ticket_user_display_number',
            'ticket',
            ['user_id', 'display_number'],
        )

    op.execute(sa.text("""
        INSERT INTO user_ticket_counter (user_id, next_value)
        SELECT user_id, COALESCE(MAX(display_number), 0) + 1
        FROM ticket
        GROUP BY user_id
        ON CONFLICT (user_id)
        DO UPDATE SET next_value = GREATEST(user_ticket_counter.next_value, EXCLUDED.next_value)
    """))

    op.alter_column('ticket', 'display_number', existing_type=sa.Integer(), nullable=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    unique_constraints = {
        constraint['name']
        for constraint in inspector.get_unique_constraints('ticket')
        if constraint.get('name')
    }
    if 'uq_ticket_user_display_number' in unique_constraints:
        op.drop_constraint('uq_ticket_user_display_number', 'ticket', type_='unique')

    ticket_columns = {column['name'] for column in inspector.get_columns('ticket')}
    if 'display_number' in ticket_columns:
        op.drop_column('ticket', 'display_number')

    table_names = set(inspector.get_table_names())
    if 'user_ticket_counter' in table_names:
        op.drop_table('user_ticket_counter')


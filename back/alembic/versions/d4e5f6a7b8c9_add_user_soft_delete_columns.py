"""add user soft delete columns

Revision ID: d4e5f6a7b8c9
Revises: 3b1c2d3e4f5a
Create Date: 2026-03-09

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "d4e5f6a7b8c9"
down_revision = "3b1c2d3e4f5a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user", sa.Column("deleted_at", sa.BigInteger(), nullable=True))
    op.add_column("user", sa.Column("auth_revoked_at", sa.BigInteger(), nullable=True))
    op.create_index(op.f("ix_user_deleted_at"), "user", ["deleted_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_user_deleted_at"), table_name="user")
    op.drop_column("user", "auth_revoked_at")
    op.drop_column("user", "deleted_at")


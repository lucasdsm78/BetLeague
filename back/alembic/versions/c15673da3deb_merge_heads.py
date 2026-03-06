"""merge heads

Revision ID: c15673da3deb
Revises: c3d4e5f6a7b8, 0c1d2e3f4a5b
Create Date: 2026-03-05 05:12:27.902925

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c15673da3deb'
down_revision = ('c3d4e5f6a7b8', '0c1d2e3f4a5b')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass


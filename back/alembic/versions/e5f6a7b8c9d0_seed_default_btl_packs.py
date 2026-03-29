"""seed default btl packs

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-03-28 10:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


PACKS = [
    {
        "name": "Pack Starter",
        "price_cents": 399,
        "nb_btl": 50.0,
        "bonus": 0.0,
        "total_btl": 50.0,
        "price_per_100": 7.98,
        "note": "Parfait pour démarrer sans pression et lancer vos premiers paris.",
    },
    {
        "name": "Pack Pro",
        "price_cents": 1299,
        "nb_btl": 180.0,
        "bonus": 40.0,
        "total_btl": 220.0,
        "price_per_100": 5.90,
        "note": "Le meilleur choix pour jouer régulièrement et profiter d’un vrai bonus.",
    },
    {
        "name": "Pack Elite",
        "price_cents": 2499,
        "nb_btl": 450.0,
        "bonus": 125.0,
        "total_btl": 575.0,
        "price_per_100": 4.35,
        "note": "L’offre la plus rentable pour maximiser vos BTL et dominer les ligues.",
    },
]


def upgrade() -> None:
    connection = op.get_bind()
    now_ms = connection.execute(
        sa.text("SELECT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint")
    ).scalar_one()

    for pack in PACKS:
        connection.execute(
            sa.text(
                """
                INSERT INTO pack (
                    name,
                    price_cents,
                    nb_btl,
                    bonus,
                    total_btl,
                    price_per_100,
                    note,
                    created_at
                )
                VALUES (
                    :name,
                    :price_cents,
                    :nb_btl,
                    :bonus,
                    :total_btl,
                    :price_per_100,
                    :note,
                    :created_at
                )
                ON CONFLICT (name) DO NOTHING
                """
            ),
            {
                **pack,
                "created_at": now_ms,
            },
        )


def downgrade() -> None:
    connection = op.get_bind()
    connection.execute(
        sa.text(
            "DELETE FROM pack WHERE name IN :names"
        ).bindparams(sa.bindparam("names", expanding=True)),
        {"names": [pack["name"] for pack in PACKS]},
    )

"""update default btl packs marketing

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-03-28 11:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


revision = "f6a7b8c9d0e1"
down_revision = "e5f6a7b8c9d0"
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
                    (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint
                )
                ON CONFLICT (name) DO UPDATE SET
                    price_cents = EXCLUDED.price_cents,
                    nb_btl = EXCLUDED.nb_btl,
                    bonus = EXCLUDED.bonus,
                    total_btl = EXCLUDED.total_btl,
                    price_per_100 = EXCLUDED.price_per_100,
                    note = EXCLUDED.note
                """
            ),
            pack,
        )


def downgrade() -> None:
    previous_values = {
        "Pack Starter": {
            "price_cents": 999,
            "nb_btl": 100.0,
            "bonus": 0.0,
            "total_btl": 100.0,
            "price_per_100": 9.99,
            "note": "Parfait pour démarrer et tester vos premiers paris.",
        },
        "Pack Pro": {
            "price_cents": 1999,
            "nb_btl": 200.0,
            "bonus": 20.0,
            "total_btl": 220.0,
            "price_per_100": 9.09,
            "note": "Le plus équilibré pour jouer régulièrement.",
        },
        "Pack Elite": {
            "price_cents": 4999,
            "nb_btl": 500.0,
            "bonus": 75.0,
            "total_btl": 575.0,
            "price_per_100": 8.69,
            "note": "Le meilleur rendement pour les gros compétiteurs.",
        },
    }

    connection = op.get_bind()
    for name, values in previous_values.items():
        connection.execute(
            sa.text(
                """
                UPDATE pack
                SET price_cents = :price_cents,
                    nb_btl = :nb_btl,
                    bonus = :bonus,
                    total_btl = :total_btl,
                    price_per_100 = :price_per_100,
                    note = :note
                WHERE name = :name
                """
            ),
            {"name": name, **values},
        )


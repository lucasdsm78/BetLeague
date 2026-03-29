from domain.purchase.model.pack import Pack


def get_default_packs_catalog() -> list[Pack]:
    return [
        Pack(
            name="Pack Starter",
            price_cents=399,
            nb_btl=50,
            bonus=0,
            total_btl=50,
            price_per_100=7.98,
            note="Parfait pour démarrer sans pression et lancer vos premiers paris.",
        ),
        Pack(
            name="Pack Pro",
            price_cents=1299,
            nb_btl=180,
            bonus=40,
            total_btl=220,
            price_per_100=5.90,
            note="Le meilleur choix pour jouer régulièrement et profiter d’un vrai bonus.",
        ),
        Pack(
            name="Pack Elite",
            price_cents=2499,
            nb_btl=450,
            bonus=125,
            total_btl=575,
            price_per_100=4.35,
            note="L’offre la plus rentable pour maximiser vos BTL et dominer les ligues.",
        ),
    ]

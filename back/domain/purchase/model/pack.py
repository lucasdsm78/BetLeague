from typing import Optional


class Pack:
    def __init__(
            self,
            name: str,
            price_cents: int,
            nb_btl: float,
            bonus: float,
            total_btl: float,
            price_per_100: float,
            note: Optional[str] = None,
            id: Optional[int] = None,
            created_at: Optional[int] = None
    ):
        self.id = id
        self.name = name
        self.price_cents = price_cents
        self.nb_btl = nb_btl
        self.bonus = bonus
        self.total_btl = total_btl
        self.price_per_100 = price_per_100
        self.note = note
        self.created_at = created_at

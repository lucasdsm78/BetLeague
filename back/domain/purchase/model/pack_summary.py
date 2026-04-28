from typing import Optional


class PackSummary:

    def __init__(
            self,
            name: str,
            price_cents: int,
            total_btl: float,
            id: Optional[int] = None
    ):
        self.id: int = id
        self.name: str = name
        self.price_cents: float = price_cents
        self.total_btl: float = total_btl

    def __eq__(self, o: object) -> bool:
        if isinstance(o, PackSummary):
            return self.id == o.id

        return False

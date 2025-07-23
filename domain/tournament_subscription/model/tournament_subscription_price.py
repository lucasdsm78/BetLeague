from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class TournamentSubscriptionPrice:
    amount: float
    currency: str

    def __post_init__(self):
        if self.amount <= 0:
            raise ValueError("Le prix doit être positif")

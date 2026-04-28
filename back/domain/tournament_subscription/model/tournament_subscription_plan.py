from enum import Enum


class TournamentSubscriptionPlan(str, Enum):
    MONTHLY = "monthly"
    YEARLY = "yearly"

    @property
    def price_cents(self) -> int:
        return 499 if self is TournamentSubscriptionPlan.MONTHLY else 2999

from dataclasses import dataclass
from enum import Enum

from domain.tournament_subscription.exception.tournament_subscription_exception import \
    InvalidTournamentSubscriptionStatusException


@dataclass(init=False, eq=True, frozen=True)
class TournamentSubscriptionStatus(Enum):
    INCOMPLETE = "incomplete"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELLED = "cancelled"
    UNPAID = "unpaid"

    @classmethod
    def from_str(cls, subscription_status: str) -> "TournamentSubscriptionStatus":
        try:
            return cls(subscription_status)
        except ValueError:
            raise InvalidTournamentSubscriptionStatusException(subscription_status) from None

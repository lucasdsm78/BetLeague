from dataclasses import dataclass
from enum import Enum
from typing import Optional

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


def map_stripe_status_to_enum(stripe_status: str) -> Optional[TournamentSubscriptionStatus]:
    stripe_to_enum_mapping = {
        "incomplete": TournamentSubscriptionStatus.INCOMPLETE,
        "incomplete_expired": TournamentSubscriptionStatus.INCOMPLETE,
        "active": TournamentSubscriptionStatus.ACTIVE,
        "past_due": TournamentSubscriptionStatus.PAST_DUE,
        "canceled": TournamentSubscriptionStatus.CANCELLED,
        "cancelled": TournamentSubscriptionStatus.CANCELLED,
        "unpaid": TournamentSubscriptionStatus.UNPAID,
        "paused": TournamentSubscriptionStatus.PAST_DUE,
    }

    # Mapping avec log
    mapped_status = stripe_to_enum_mapping.get(stripe_status.lower(), TournamentSubscriptionStatus.INCOMPLETE)

    if stripe_status.lower() not in stripe_to_enum_mapping:
        return None
    else:
        print(f"✅ Mapping statut: '{stripe_status}' -> {mapped_status}")
        return mapped_status

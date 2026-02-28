from enum import Enum
from dataclasses import dataclass

from domain.match.exception.match_exception import InvalidSportException


@dataclass(init=False, eq=True, frozen=True)
class Sport(Enum):
    FOOTBALL = "football"
    BASKETBALL = "basketball"
    RUGBY = "rugby"
    HOCKEY = "hockey"
    BASEBALL = "baseball"
    TENNIS = "tennis"

    @classmethod
    def from_str(cls, sport: str) -> "Sport":
        try:
            return cls(sport.lower())
        except ValueError:
            raise InvalidSportException(sport) from None

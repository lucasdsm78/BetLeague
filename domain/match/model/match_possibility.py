from enum import Enum
from dataclasses import dataclass

from domain.match.exception.match_exception import InvalidMatchPossibilityException


@dataclass(init=False, eq=True, frozen=True)
class MatchPossibility(Enum):
    home_team_winner = 'HOME_TEAM'
    away_team_winner = 'AWAY_TEAM'
    draw = 'DRAW'

    @classmethod
    def from_str(cls, match_possibility: str) -> "MatchPossibility":
        try:
            return cls(match_possibility)
        except ValueError:
            raise InvalidMatchPossibilityException(match_possibility) from None

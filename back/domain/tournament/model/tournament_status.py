from dataclasses import dataclass
from enum import Enum

from domain.tournament.exception.tournament_exception import InvalidTournamentStatusException


@dataclass(init=False, eq=True, frozen=True)
class TournamentStatus(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

    @classmethod
    def from_str(cls, tournament_status: str) -> "TournamentStatus":
        try:
            return cls(tournament_status)
        except ValueError:
            raise InvalidTournamentStatusException(tournament_status) from None

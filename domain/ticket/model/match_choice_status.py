from enum import Enum
from dataclasses import dataclass

from domain.ticket.exception.ticket_exception import InvalidMatchChoiceStatusException


@dataclass(init=False, eq=True, frozen=True)
class MatchChoiceStatus(Enum):
    correct = 'CORRECT'
    wrong = 'WRONG'
    pending = 'PENDING'

    @classmethod
    def from_str(cls, match_choice_status: str) -> "MatchChoiceStatus":
        try:
            return cls(match_choice_status)
        except ValueError:
            raise InvalidMatchChoiceStatusException(match_choice_status) from None

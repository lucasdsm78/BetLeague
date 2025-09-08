from enum import Enum
from dataclasses import dataclass

from domain.ticket.exception.ticket_exception import InvalidMatchChoiceStatusException, InvalidTicketStatusException


@dataclass(init=False, eq=True, frozen=True)
class TicketStatus(Enum):
    correct = 'CORRECT'
    wrong = 'WRONG'
    pending = 'PENDING'

    @classmethod
    def from_str(cls, ticket_status: str) -> "TicketStatus":
        try:
            return cls(ticket_status)
        except ValueError:
            raise InvalidTicketStatusException(ticket_status) from None

from enum import Enum
from dataclasses import dataclass

from domain.ticket.exception.ticket_exception import InvalidTicketStatusException


@dataclass(init=False, eq=True, frozen=True)
class InvitationStatus(Enum):
    accepted = 'ACCEPTED'
    refused = 'REFUSED'
    pending = 'PENDING'

    @classmethod
    def from_str(cls, invitation_status: str) -> "InvitationStatus":
        try:
            return cls(invitation_status)
        except ValueError:
            raise InvalidTicketStatusException(invitation_status) from None

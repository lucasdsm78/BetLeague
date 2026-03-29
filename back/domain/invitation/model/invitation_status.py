from enum import Enum
from dataclasses import dataclass

from domain.invitation.exception.invitation_exception import InvalidInvitationStatusException


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
            raise InvalidInvitationStatusException(invitation_status) from None

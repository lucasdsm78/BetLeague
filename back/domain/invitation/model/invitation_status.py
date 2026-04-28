from enum import Enum

from domain.invitation.exception.invitation_exception import InvalidInvitationStatusException


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

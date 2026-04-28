class InvalidInvitationStatusException(Exception):
    message = "This invitation status is not a valid invitation status"

    def __init__(self, invitation_status: str):
        self.invitation_status = invitation_status

    def __str__(self):
        return f"{self.invitation_status} is not a valid invitation status"


class InvitationNotFoundError(Exception):
    message = "The invitation does not exist."

    def __str__(self):
        return InvitationNotFoundError.message


class InvitationFoundError(Exception):
    message = "The invitation already exists."

    def __str__(self):
        return InvitationFoundError.message


class InvitationDeletionNotAllowedError(Exception):
    message = "Only pending invitations can be deleted."

    def __str__(self):
        return InvitationDeletionNotAllowedError.message

class InvalidInvitationStatusException(Exception):
    message = "Ce statut d'invitation n'est pas valide"

    def __init__(self, invitation_status: str):
        self.invitation_status = invitation_status

    def __str__(self):
        return f"{self.invitation_status} n'est pas un statut d'invitation valide"


class InvitationNotFoundError(Exception):
    message = "L'invitation n'existe pas."

    def __str__(self):
        return InvitationNotFoundError.message


class InvitationFoundError(Exception):
    message = "L'invitation existe déjà."

    def __str__(self):
        return InvitationFoundError.message


class InvitationDeletionNotAllowedError(Exception):
    message = "Seules les invitations en attente peuvent être supprimées."

    def __str__(self):
        return InvitationDeletionNotAllowedError.message

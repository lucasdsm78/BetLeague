class TicketNotFoundError(Exception):
    message = "Le ticket n'existe pas."

    def __str__(self):
        return TicketNotFoundError.message


class NotTicketOwnerError(Exception):
    message = "Vous n'êtes pas le propriétaire de ce ticket."

    def __str__(self):
        return NotTicketOwnerError.message


class MatchAlreadyStartedError(Exception):
    message = "Impossible de retirer ce ticket : un ou plusieurs matchs ont déjà commencé."

    def __str__(self):
        return MatchAlreadyStartedError.message


class InvalidMatchChoiceStatusException(Exception):
    message = "Ce statut de choix de match n'est pas valide."

    def __init__(self, match_choice_status: str):
        self.match_choice_status = match_choice_status

    def __str__(self):
        return f"{self.match_choice_status} n'est pas un statut de choix de match valide."


class InvalidTicketStatusException(Exception):
    message = "Ce statut de ticket n'est pas valide."

    def __init__(self, ticket_status: str):
        self.ticket_status = ticket_status

    def __str__(self):
        return f"{self.ticket_status} n'est pas un statut de ticket valide."


class GainNotEqualsError(Exception):
    message = "Le gain calculé pour ce ticket est invalide."

    def __str__(self):
        return self.message


class MiseSuperiorToNbBtlError(Exception):
    message = "La mise est supérieure à votre solde de BTL."

    def __str__(self):
        return self.message


class TicketAccessDeniedError(Exception):
    message = "Vous n'avez pas l'autorisation de consulter ce ticket."

    def __str__(self):
        return self.message


class TicketNotShareableError(Exception):
    message = "Ce ticket ne peut pas être partagé."

    def __str__(self):
        return self.message

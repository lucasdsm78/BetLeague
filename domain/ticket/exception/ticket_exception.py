class TicketNotFoundError(Exception):
    message = "The ticket does not exist."

    def __str__(self):
        return TicketNotFoundError.message


class NotTicketOwnerError(Exception):
    message = "You are not the ticket owner."

    def __str__(self):
        return NotTicketOwnerError.message


class MatchAlreadyStartedError(Exception):
    message = "Impossible de retirer ce ticket : un ou plusieurs matchs ont déjà commencé."

    def __str__(self):
        return MatchAlreadyStartedError.message


class InvalidMatchChoiceStatusException(Exception):
    message = "This match choice status is not a valid match choice status"

    def __init__(self, match_choice_status: str):
        self.match_choice_status = match_choice_status

    def __str__(self):
        return f"{self.match_choice_status} is not a valid match choice status"


class InvalidTicketStatusException(Exception):
    message = "This ticket status is not a valid ticket status"

    def __init__(self, ticket_status: str):
        self.ticket_status = ticket_status

    def __str__(self):
        return f"{self.ticket_status} is not a valid ticket status"


class GainNotEqualsError(Exception):
    message = "The gain for this match is not equals"

    def __str__(self):
        return self.message


class MiseSuperiorToNbBtlError(Exception):
    message = "The mise is superior to your btl points"

    def __str__(self):
        return self.message

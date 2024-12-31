class TicketNotFoundError(Exception):
    message = "The ticket does not exist."

    def __str__(self):
        return TicketNotFoundError.message

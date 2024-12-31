class MatchesNotFoundError(Exception):
    message = "No matches found from the API."

    def __str__(self):
        return MatchesNotFoundError.message


class MatchNotFoundError(Exception):
    message = "The match does not exist."

    def __str__(self):
        return MatchNotFoundError.message

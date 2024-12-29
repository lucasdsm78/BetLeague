class MatchesNotFoundError(Exception):
    message = "No matches found from the API."

    def __str__(self):
        return MatchesNotFoundError.message

class MatchesNotFoundError(Exception):
    message = "No matches found from the API."

    def __str__(self):
        return MatchesNotFoundError.message


class MatchNotFoundError(Exception):
    message = "The match does not exist."

    def __str__(self):
        return MatchNotFoundError.message


class InvalidMatchPossibilityException(Exception):
    message = "This match possibility is not a valid match possibility"

    def __init__(self, match_possibility: str):
        self.match_possibility = match_possibility

    def __str__(self):
        return f"{self.match_possibility} is not a valid match possibility"

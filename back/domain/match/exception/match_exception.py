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


class InvalidMatchStatusException(Exception):
    message = "This match status is not valid"

    def __init__(self, match_status: str):
        self.match_status = match_status

    def __str__(self):
        return f"{self.match_status} is not a valid match status"


class InvalidSportException(Exception):
    message = "This sport is not valid"

    def __init__(self, sport: str):
        self.sport = sport

    def __str__(self):
        return f"{self.sport} is not a valid sport"

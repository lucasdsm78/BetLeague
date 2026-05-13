class MatchesNotFoundError(Exception):
    message = "Aucun match n'a été trouvé."

    def __str__(self):
        return MatchesNotFoundError.message


class MatchNotFoundError(Exception):
    message = "Le match n'existe pas."

    def __str__(self):
        return MatchNotFoundError.message


class InvalidMatchPossibilityException(Exception):
    message = "Cette possibilité de match n'est pas valide"

    def __init__(self, match_possibility: str):
        self.match_possibility = match_possibility

    def __str__(self):
        return f"{self.match_possibility} n'est pas une possibilité de match valide"


class InvalidMatchStatusException(Exception):
    message = "Ce statut de match n'est pas valide"

    def __init__(self, match_status: str):
        self.match_status = match_status

    def __str__(self):
        return f"{self.match_status} n'est pas un statut de match valide"


class InvalidSportException(Exception):
    message = "Ce sport n'est pas valide"

    def __init__(self, sport: str):
        self.sport = sport

    def __str__(self):
        return f"{self.sport} n'est pas un sport valide"

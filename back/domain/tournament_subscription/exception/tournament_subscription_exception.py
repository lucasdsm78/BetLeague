class InvalidTournamentSubscriptionStatusException(Exception):
    message = "This tournament subscription status is not a valid tournament subscription status"

    def __init__(self, tournament_subscription_status: str):
        self.tournament_subscription_status = tournament_subscription_status

    def __str__(self):
        return f"{self.tournament_subscription_status} is not a valid tournament subscription status"

class TournamentSubscriptionNotFoundError(Exception):
    message = "The tournament subscription does not exist."

    def __str__(self):
        return TournamentSubscriptionNotFoundError.message

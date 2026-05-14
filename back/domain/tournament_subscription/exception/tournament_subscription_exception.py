class InvalidTournamentSubscriptionStatusException(Exception):
    message = "Ce statut d'abonnement tournoi n'est pas valide"

    def __init__(self, tournament_subscription_status: str):
        self.tournament_subscription_status = tournament_subscription_status

    def __str__(self):
        return f"{self.tournament_subscription_status} n'est pas un statut d'abonnement tournoi valide"

class TournamentSubscriptionNotFoundError(Exception):
    message = "L'abonnement tournoi n'existe pas."

    def __str__(self):
        return TournamentSubscriptionNotFoundError.message


class TournamentSubscriptionInactiveError(Exception):
    message = "Aucun abonnement tournoi actif à annuler"

    def __str__(self):
        return TournamentSubscriptionInactiveError.message


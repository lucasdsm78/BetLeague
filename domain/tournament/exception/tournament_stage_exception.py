class TournamentStageNotFoundError(Exception):
    message = "Le tournoi demandé n'existe pas pour ce stage"

    def __str__(self):
        return TournamentStageNotFoundError.message

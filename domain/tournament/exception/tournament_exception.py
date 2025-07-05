class TournamentNotFoundError(Exception):
    message = "Le tournoi demandé n'existe pas"

    def __str__(self):
        return TournamentNotFoundError.message


class TournamentFullError(Exception):
    message = "Le tournoi est complet"

    def __str__(self):
        return TournamentFullError.message


class TournamentAlreadyStartedError(Exception):
    message = "Le tournoi a déjà commencé"

    def __str__(self):
        return TournamentAlreadyStartedError.message


class TournamentNotEnoughPlayersError(Exception):
    message = "Le tournoi nécessite un minimum de players pour démarrer"

    def __str__(self):
        return TournamentNotEnoughPlayersError.message


class UserAlreadyInTournamentError(Exception):
    message = "Vous êtes déjà inscrit à ce tournoi"

    def __str__(self):
        return UserAlreadyInTournamentError.message


class InvalidTournamentStatusException(Exception):
    message = "This tournament status is not a valid tournament status"

    def __init__(self, tournament_status: str):
        self.tournament_status = tournament_status

    def __str__(self):
        return f"{self.tournament_status} is not a valid tournament status"


class InvalidStageTypeException(Exception):
    message = "This stage type is not a valid stage type"

    def __init__(self, stage_type: str):
        self.stage_type = stage_type

    def __str__(self):
        return f"{self.stage_type} is not a valid stage type"


class UserNotInTournamentError(Exception):
    message = "Vous n'êtes pas inscrit à ce tournoi"

    def __str__(self):
        return UserNotInTournamentError.message


class UserNotSubscribedError(Exception):
    message = "Vous devez être abonné à l'option tournoi pour participer"

    def __str__(self):
        return UserNotSubscribedError.message


class TournamentNotOwnerLeaguedError(Exception):
    message = "The user is not owner of the tournament."

    def __str__(self):
        return TournamentNotOwnerLeaguedError.message


class TournamentNameAlreadyExistsError(Exception):
    message = "The tournament with the name you specified already exists."

    def __str__(self):
        return TournamentNameAlreadyExistsError.message

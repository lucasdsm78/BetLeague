class TournamentNotFoundError(Exception):
    message = "Le tournoi demandé n'existe pas"

    def __str__(self):
        return TournamentNotFoundError.message


class TournamentMatchNotFoundError(Exception):
    message = "Le match du tournoi demandé n'existe pas"

    def __str__(self):
        return TournamentMatchNotFoundError.message


class TournamentPlayerNotFoundError(Exception):
    message = "Le player du tournoi n'existe pas"

    def __str__(self):
        return TournamentPlayerNotFoundError.message


class TournamentPlayerFoundError(Exception):
    message = "Le player du tournoi existe déjà"

    def __str__(self):
        return TournamentPlayerFoundError.message


class TournamentSelfInvitationError(Exception):
    message = "Vous ne pouvez pas vous inviter vous-même dans votre tournoi"

    def __str__(self):
        return TournamentSelfInvitationError.message


class TournamentMaxPlayersError(Exception):
    message = "The tournament can't have more players than the maximum of the players."

    def __str__(self):
        return TournamentMaxPlayersError.message


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


class TournamentNotThePlayerError(Exception):
    message = "The user is not the player."

    def __str__(self):
        return TournamentNotThePlayerError.message


class TournamentNameAlreadyExistsError(Exception):
    message = "The tournament with the name you specified already exists."

    def __str__(self):
        return TournamentNameAlreadyExistsError.message


class UserNotInvitationTournamentError(Exception):
    message = "The user is not owner of the invitation for the tournament."

    def __str__(self):
        return UserNotInvitationTournamentError.message


class NotEnoughPaidPlayersError(Exception):
    message = "Not enough players have paid to start the tournament."

    def __str__(self):
        return NotEnoughPaidPlayersError.message


class TournamentNotStartedError(Exception):
    message = "The tournament is not started."

    def __str__(self):
        return TournamentNotStartedError.message


class TournamentStageNotFoundError(Exception):
    message = "Le tournoi demandé n'existe pas pour ce stage"

    def __str__(self):
        return TournamentStageNotFoundError.message


class TournamentMonthlyFreeCreationLimitReachedError(Exception):
    code = "TOURNAMENT_MONTHLY_FREE_CREATION_LIMIT_REACHED"

    def __init__(self, *, monthly_free_limit: int, monthly_free_used: int):
        self.monthly_free_limit = monthly_free_limit
        self.monthly_free_used = max(0, monthly_free_used)
        self.monthly_free_remaining = max(0, monthly_free_limit - self.monthly_free_used)
        self.message = (
            f"Vous avez utilisé vos {self.monthly_free_limit} tournois gratuits ce mois-ci. "
            "Abonnez-vous pour créer des tournois illimités."
        )

    def __str__(self):
        return self.message

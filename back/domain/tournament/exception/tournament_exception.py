class TournamentNotFoundError(Exception):
    message = "Le tournoi demandé n'existe pas"

    def __str__(self):
        return TournamentNotFoundError.message


class TournamentMatchNotFoundError(Exception):
    message = "Le match du tournoi demandé n'existe pas"

    def __str__(self):
        return TournamentMatchNotFoundError.message


class TournamentPlayerNotFoundError(Exception):
    message = "Le joueur du tournoi n'existe pas"

    def __str__(self):
        return TournamentPlayerNotFoundError.message


class TournamentPlayerFoundError(Exception):
    message = "Le joueur du tournoi existe déjà"

    def __str__(self):
        return TournamentPlayerFoundError.message


class TournamentSelfInvitationError(Exception):
    message = "Vous ne pouvez pas vous inviter vous-même dans votre tournoi"

    def __str__(self):
        return TournamentSelfInvitationError.message


class TournamentMaxPlayersError(Exception):
    message = "Le tournoi a atteint son nombre maximum de joueurs"

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
    message = "Le tournoi doit être complet pour démarrer le bracket"

    def __str__(self):
        return TournamentNotEnoughPlayersError.message


class UserAlreadyInTournamentError(Exception):
    message = "Vous êtes déjà inscrit à ce tournoi"

    def __str__(self):
        return UserAlreadyInTournamentError.message


class InvalidTournamentStatusException(Exception):
    message = "Ce statut de tournoi n'est pas valide"

    def __init__(self, tournament_status: str):
        self.tournament_status = tournament_status

    def __str__(self):
        return f"{self.tournament_status} n'est pas un statut de tournoi valide"


class InvalidStageTypeException(Exception):
    message = "Ce type d'étape n'est pas valide"

    def __init__(self, stage_type: str):
        self.stage_type = stage_type

    def __str__(self):
        return f"{self.stage_type} n'est pas un type d'étape valide"


class UserNotInTournamentError(Exception):
    message = "Vous n'êtes pas inscrit à ce tournoi"

    def __str__(self):
        return UserNotInTournamentError.message


class UserNotSubscribedError(Exception):
    message = "Vous devez être abonné à l'option tournoi pour participer"

    def __str__(self):
        return UserNotSubscribedError.message


class TournamentNotOwnerLeaguedError(Exception):
    message = "Vous n'êtes pas le propriétaire de ce tournoi."

    def __str__(self):
        return TournamentNotOwnerLeaguedError.message


class TournamentNotThePlayerError(Exception):
    message = "Vous n'êtes pas le joueur concerné par ce tournoi."

    def __str__(self):
        return TournamentNotThePlayerError.message


class TournamentOwnerCannotLeaveError(Exception):
    message = "Le créateur du tournoi ne peut pas quitter son propre tournoi"

    def __str__(self):
        return TournamentOwnerCannotLeaveError.message


class TournamentNameAlreadyExistsError(Exception):
    message = "Un tournoi avec ce nom existe déjà."

    def __str__(self):
        return TournamentNameAlreadyExistsError.message


class UserNotInvitationTournamentError(Exception):
    message = "Vous n'êtes pas propriétaire de cette invitation de tournoi."

    def __str__(self):
        return UserNotInvitationTournamentError.message


class NotEnoughPaidPlayersError(Exception):
    message = "Il n'y a pas assez de joueurs ayant payé pour démarrer le tournoi."

    def __str__(self):
        return NotEnoughPaidPlayersError.message


class TournamentNotStartedError(Exception):
    message = "Le tournoi n'a pas encore commencé."

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

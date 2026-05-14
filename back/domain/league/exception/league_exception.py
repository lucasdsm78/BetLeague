class LeagueNameAlreadyExistsError(Exception):
    message = "Une ligue avec ce nom existe déjà."

    def __str__(self):
        return LeagueNameAlreadyExistsError.message


class LeagueMaxPlayersError(Exception):
    message = "Le nombre maximal de joueurs pour cette ligue est invalide."

    def __str__(self):
        return LeagueMaxPlayersError.message


class LeagueMustHaveNbBtlError(Exception):
    message = "Cette ligue n'est pas gratuite : un montant de BTL est requis."

    def __str__(self):
        return LeagueMustHaveNbBtlError.message


class LeagueNotThePlayerError(Exception):
    message = "Vous n'êtes pas le joueur concerné par cette ligue."

    def __str__(self):
        return LeagueNotThePlayerError.message


class LeagueNbBtlIsNotEnoughError(Exception):
    message = "Votre solde de BTL est insuffisant pour rejoindre cette ligue."

    def __str__(self):
        return LeagueNbBtlIsNotEnoughError.message


class LeagueNotFoundError(Exception):
    message = "La ligue n'existe pas."

    def __str__(self):
        return LeagueNotFoundError.message


class LeagueParticipantFoundError(Exception):
    message = "Vous participez déjà à cette ligue."

    def __str__(self):
        return LeagueParticipantFoundError.message


class LeagueParticipantNotFoundError(Exception):
    message = "Vous ne participez pas à cette ligue."

    def __str__(self):
        return LeagueParticipantNotFoundError.message


class NbBTLHasReached0(Exception):
    message = "Votre solde de BTL dans cette ligue a atteint 0."

    def __str__(self):
        return NbBTLHasReached0.message


class LeagueNotStartedError(Exception):
    message = "La ligue n'a pas encore commencé."

    def __str__(self):
        return LeagueNotStartedError.message


class LeagueAlreadyStartedError(Exception):
    message = "La ligue a déjà commencé."

    def __str__(self):
        return LeagueAlreadyStartedError.message


class LeagueMinimumPlayersNotReachedError(Exception):
    message = "Le nombre minimum de joueurs requis pour démarrer la ligue n'est pas atteint."

    def __str__(self):
        return LeagueMinimumPlayersNotReachedError.message


class UserNotOwnerLeaguedError(Exception):
    message = "Vous n'êtes pas le propriétaire de cette ligue."

    def __str__(self):
        return UserNotOwnerLeaguedError.message

class UserNotInvitationLeaguedError(Exception):
    message = "Vous n'êtes pas propriétaire de cette invitation de ligue."

    def __str__(self):
        return UserNotInvitationLeaguedError.message

class LeagueNotFinishedError(Exception):
    message = "La ligue n'est pas terminée."

    def __str__(self):
        return LeagueNotFinishedError.message

class LeagueFinishedError(Exception):
    message = "La ligue est terminée."

    def __str__(self):
        return LeagueFinishedError.message

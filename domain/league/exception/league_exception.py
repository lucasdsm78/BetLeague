class LeagueNameAlreadyExistsError(Exception):
    message = "The league with the name you specified already exists."

    def __str__(self):
        return LeagueNameAlreadyExistsError.message


class LeagueMaxPlayersError(Exception):
    message = "The league can't have more players than the maximum of the players."

    def __str__(self):
        return LeagueMaxPlayersError.message


class LeagueNotFoundError(Exception):
    message = "The league does not exist."

    def __str__(self):
        return LeagueNotFoundError.message


class LeagueParticipantFoundError(Exception):
    message = "You are participating in this league."

    def __str__(self):
        return LeagueParticipantFoundError.message


class LeagueParticipantNotFoundError(Exception):
    message = "You are not participating in this league."

    def __str__(self):
        return LeagueParticipantNotFoundError.message


class NbBTLHasReached0(Exception):
    message = "Your number of BTL in this league has been reached 0."

    def __str__(self):
        return NbBTLHasReached0.message


class LeagueNotStartedError(Exception):
    message = "The league is not started."

    def __str__(self):
        return LeagueNotStartedError.message


class LeagueAlreadyStartedError(Exception):
    message = "The league is already started."

    def __str__(self):
        return LeagueAlreadyStartedError.message

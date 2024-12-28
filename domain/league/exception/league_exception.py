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

class LeagueNameAlreadyExistsError(Exception):
    message = "The league with the name you specified already exists."

    def __str__(self):
        return LeagueNameAlreadyExistsError.message


class LeagueNotFoundError(Exception):
    message = "The league does not exist."

    def __str__(self):
        return LeagueNotFoundError.message

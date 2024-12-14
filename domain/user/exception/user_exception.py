class UserEmailAlreadyExistsError(Exception):
    message = "The user with the email code you specified already exists."

    def __str__(self):
        return UserEmailAlreadyExistsError.message


class UsersNotFoundError(Exception):
    message = "No users found from the API."

    def __str__(self):
        return UsersNotFoundError.message


class UserNotFoundError(Exception):
    message = "The user does not exist."

    def __str__(self):
        return UserNotFoundError.message


class UserLoginNotFoundError(Exception):

    def __init__(self, login: str):
        self.login = login

    def __str__(self):
        return f"user with login {self.login} not found"

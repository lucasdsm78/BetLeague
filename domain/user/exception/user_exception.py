class UserEmailAlreadyExistsError(Exception):
    message = "The user with the email code you specified already exists."

    def __str__(self):
        return UserEmailAlreadyExistsError.message


class FARequiredError(Exception):
    message = "2FA code is required."

    def __str__(self):
        return FARequiredError.message


class Invalid2FACodeError(Exception):
    message = "Invalid 2FA code."

    def __str__(self):
        return Invalid2FACodeError.message


class UserPseudoAlreadyExistsError(Exception):
    message = "The user with the pseudo you specified already exists."

    def __str__(self):
        return UserPseudoAlreadyExistsError.message


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

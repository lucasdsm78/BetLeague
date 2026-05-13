class UserEmailAlreadyExistsError(Exception):
    message = "Un utilisateur avec cet email existe déjà."

    def __str__(self):
        return UserEmailAlreadyExistsError.message


class FARequiredError(Exception):
    message = "Le code 2FA est requis."

    def __str__(self):
        return FARequiredError.message


class Invalid2FACodeError(Exception):
    message = "Le code 2FA est invalide."

    def __str__(self):
        return Invalid2FACodeError.message


class UserPseudoAlreadyExistsError(Exception):
    message = "Un utilisateur avec ce pseudo existe déjà."

    def __str__(self):
        return UserPseudoAlreadyExistsError.message


class UsersNotFoundError(Exception):
    message = "Aucun utilisateur n'a été trouvé."

    def __str__(self):
        return UsersNotFoundError.message


class UserNotFoundError(Exception):
    message = "L'utilisateur n'existe pas."

    def __str__(self):
        return UserNotFoundError.message

class UserNotOwnerError(Exception):
    message = "L'utilisateur connecté ne correspond pas à cette ressource."

    def __str__(self):
        return UserNotOwnerError.message

class UserLoginNotFoundError(Exception):

    def __init__(self, login: str):
        self.login = login

    def __str__(self):
        return f"Aucun utilisateur trouvé pour l'identifiant {self.login}"

class PasswordResetNotEnabledError(Exception):
    message = "La réinitialisation du mot de passe n'est pas activée."

    def __str__(self):
        return PasswordResetNotEnabledError.message

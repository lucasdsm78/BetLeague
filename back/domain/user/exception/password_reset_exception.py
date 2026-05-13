class PasswordResetError(Exception):
    message: str = "Erreur de réinitialisation du mot de passe"


class PasswordResetChallengeNotFoundError(PasswordResetError):
    message = "La demande de réinitialisation est introuvable ou expirée"


class PasswordResetRateLimitedError(PasswordResetError):
    message = "Trop de tentatives, réessayez plus tard"


class PasswordResetInvalidCodeError(PasswordResetError):
    message = "Code invalide"


class PasswordResetInvalidTokenError(PasswordResetError):
    message = "Le jeton de réinitialisation est invalide ou expiré"


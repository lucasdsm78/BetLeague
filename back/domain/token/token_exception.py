class TokenInvalidError(Exception):
    message = "Le jeton n'est pas valide."

    def __str__(self):
        return TokenInvalidError.message

class TokenInvalidError(Exception):
    message = "The token is not valid."

    def __str__(self):
        return TokenInvalidError.message

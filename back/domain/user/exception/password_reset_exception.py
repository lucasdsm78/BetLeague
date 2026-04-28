class PasswordResetError(Exception):
    message: str = "Password reset error"


class PasswordResetChallengeNotFoundError(PasswordResetError):
    message = "Reset challenge not found or expired"


class PasswordResetRateLimitedError(PasswordResetError):
    message = "Too many requests"


class PasswordResetInvalidCodeError(PasswordResetError):
    message = "Invalid code"


class PasswordResetInvalidTokenError(PasswordResetError):
    message = "Invalid or expired reset token"


from __future__ import annotations

import secrets
import string


class OTPService:
    """Génère des codes OTP numériques et tokens cryptographiquement sûrs."""

    @staticmethod
    def generate_numeric_code(length: int = 6) -> str:
        if length <= 0:
            raise ValueError("length must be > 0")
        alphabet = string.digits
        return ''.join(secrets.choice(alphabet) for _ in range(length))

    @staticmethod
    def generate_urlsafe_token(nbytes: int = 32) -> str:
        return secrets.token_urlsafe(nbytes)


from __future__ import annotations

from pydantic import BaseModel, Field
import re
from pydantic import field_validator

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class PasswordForgotRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL_RE.match(v):
            raise ValueError("Invalid email")
        return v


class PasswordForgotResponse(BaseModel):
    challenge_id: str
    expires_in_seconds: int
    message: str = "If the account exists and 2FA is enabled, you can verify using your authenticator code."


class PasswordResetVerifyRequest(BaseModel):
    email: str
    challenge_id: str = Field(min_length=10, max_length=128)
    code: str = Field(min_length=6, max_length=12)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL_RE.match(v):
            raise ValueError("Invalid email")
        return v


class PasswordResetVerifyResponse(BaseModel):
    reset_token: str
    expires_in_seconds: int


class PasswordResetConfirmRequest(BaseModel):
    email: str
    challenge_id: str = Field(min_length=10, max_length=128)
    reset_token: str = Field(min_length=20, max_length=512)
    new_password: str = Field(min_length=8, max_length=256)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL_RE.match(v):
            raise ValueError("Invalid email")
        return v


class PasswordResetConfirmResponse(BaseModel):
    message: str = "Password updated."

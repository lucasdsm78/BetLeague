import re
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_PSEUDO_RE = re.compile(r"^[a-zA-Z0-9\s\-_.]+$")


class _StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class UserCreateModel(_StrictModel):
    pseudo: str = Field(min_length=2, max_length=50)
    email: str = Field(min_length=5, max_length=320)
    password: str = Field(min_length=8, max_length=255)

    @field_validator("pseudo")
    @classmethod
    def validate_pseudo(cls, value: str) -> str:
        if not _PSEUDO_RE.match(value):
            raise ValueError("Pseudo invalide")
        return value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not _EMAIL_RE.match(normalized):
            raise ValueError("Email invalide")
        return normalized


class UserUpdateModel(_StrictModel):
    pseudo: Optional[str] = Field(default=None, min_length=2, max_length=50)
    email: Optional[str] = Field(default=None, min_length=5, max_length=320)
    current_password: Optional[str] = Field(default=None, min_length=8, max_length=255)
    two_fa_code: Optional[str] = Field(default=None, min_length=6, max_length=6, pattern=r"^\d{6}$")

    @field_validator("pseudo")
    @classmethod
    def validate_optional_pseudo(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if not _PSEUDO_RE.match(value):
            raise ValueError("Pseudo invalide")
        return value

    @field_validator("email")
    @classmethod
    def validate_optional_email(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        normalized = value.strip().lower()
        if not _EMAIL_RE.match(normalized):
            raise ValueError("Email invalide")
        return normalized

    @model_validator(mode="after")
    def validate_sensitive_update(self):
        if self.email and not self.current_password:
            raise ValueError("Le mot de passe actuel est requis pour changer l'email")
        if self.pseudo is None and self.email is None:
            raise ValueError("Aucune modification demandée")
        return self


class DeleteMyAccountModel(_StrictModel):
    current_password: str = Field(min_length=8, max_length=255)
    two_fa_code: Optional[str] = Field(default=None, min_length=6, max_length=6)


class ChangeMyPasswordModel(_StrictModel):
    current_password: str = Field(min_length=8, max_length=255)
    new_password: str = Field(min_length=8, max_length=255)
    two_fa_code: Optional[str] = Field(default=None, min_length=6, max_length=6)


class UserCreateResponse(BaseModel):
    message: str = "Si l'inscription est possible, vous pouvez maintenant vous connecter."


class UserUpdateResponse(BaseModel):
    token_auth: str
    refresh_token: Optional[str] = None
    token_expiration: str


class UserDeleteResponse(BaseModel):
    message: str = "Compte supprimé avec succès."


class ChangeMyPasswordResponse(BaseModel):
    message: str = "Mot de passe mis à jour."
    reauth_required: bool = True


class UserLoginModel(_StrictModel):
    email: str = Field(min_length=5, max_length=320)
    password: str = Field(min_length=1, max_length=255)
    code: Optional[str] = Field(default=None, min_length=6, max_length=6, pattern=r"^\d{6}$")

    @field_validator("email")
    @classmethod
    def validate_login_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not _EMAIL_RE.match(normalized):
            raise ValueError("Email invalide")
        return normalized


class UserLoginResponse(BaseModel):
    token_auth: str
    uuid: str
    refresh_token: Optional[str] = None
    token_expiration: str
    two_factor_enabled: bool = False

    def for_login(self, include_refresh_token: bool = False):
        payload = dict(
            token_auth=self.token_auth,
            uuid=self.uuid,
            token_expiration=self.token_expiration,
            two_factor_enabled=self.two_factor_enabled,
            message="login successful"
        )
        if include_refresh_token and self.refresh_token:
            payload["refresh_token"] = self.refresh_token
        return payload


class RefreshTokenResponse(BaseModel):
    token_auth: str
    refresh_token: Optional[str] = None
    token_expiration: str
    message: str = "Token refreshed successfully"


class InvalidPasswordError(Exception):

    def __init__(self, email: str):
        self.email = email

    def __str__(self):
        return f"Password invalid for user {self.email}"


class VerifyTwoFactorModel(_StrictModel):
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class DisableTwoFactorModel(_StrictModel):
    current_password: str = Field(min_length=8, max_length=255)
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class TwoFactorSetupResponse(BaseModel):
    qr_code: str
    secret: str
    otpauth_url: str
    message: str = "2FA setup ready."


class TwoFactorStatusResponse(BaseModel):
    enabled: bool
    message: str
    attempts_remaining: Optional[int] = None


class DisableTwoFactorResponse(BaseModel):
    enabled: bool = False
    message: str = "Authentification à deux facteurs désactivée."
    sessions_revoked: bool = True
    reauth_required: bool = True


from typing import Optional

from pydantic import BaseModel, Field


class UserCreateModel(BaseModel):
    pseudo: str
    email: str
    password: str


class UserUpdateModel(BaseModel):
    pseudo: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    two_fa_code: Optional[str] = None


class DeleteMyAccountModel(BaseModel):
    current_password: str = Field(min_length=8, max_length=255)
    two_fa_code: Optional[str] = Field(default=None, min_length=6, max_length=6)


class ChangeMyPasswordModel(BaseModel):
    current_password: str = Field(min_length=8, max_length=255)
    new_password: str = Field(min_length=8, max_length=255)
    two_fa_code: Optional[str] = Field(default=None, min_length=6, max_length=6)


class UserCreateResponse(BaseModel):
    message: str = "The user is well created"


class UserUpdateResponse(BaseModel):
    token_auth: str
    refresh_token: str
    token_expiration: str


class UserDeleteResponse(BaseModel):
    message: str = "Compte supprimé avec succès."


class ChangeMyPasswordResponse(BaseModel):
    message: str = "Mot de passe mis à jour."
    reauth_required: bool = True


class UserLoginModel(BaseModel):
    email: str
    password: str
    code: Optional[str] = None


class UserLoginResponse(BaseModel):
    token_auth: str
    uuid: str
    refresh_token: str
    token_expiration: str
    two_factor_enabled: bool = False

    def for_login(self):
        return dict(
            token_auth=self.token_auth,
            uuid=self.uuid,
            refresh_token=self.refresh_token,
            token_expiration=self.token_expiration,
            two_factor_enabled=self.two_factor_enabled,
            message="login successful"
        )


class RefreshTokenModel(BaseModel):
    refresh_token: str


class RefreshTokenResponse(BaseModel):
    token_auth: str
    refresh_token: str
    token_expiration: str
    message: str = "Token refreshed successfully"


class InvalidPasswordError(Exception):

    def __init__(self, email: str):
        self.email = email

    def __str__(self):
        return f"Password invalid for user {self.email}"


class VerifyTwoFactorModel(BaseModel):
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class DisableTwoFactorModel(BaseModel):
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


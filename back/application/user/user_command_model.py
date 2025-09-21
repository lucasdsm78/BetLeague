from typing import Optional

from pydantic import BaseModel


class UserCreateModel(BaseModel):
    pseudo: str
    email: str
    password: str


class UserUpdateModel(BaseModel):
    pseudo: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    two_fa_code: Optional[str] = None


class UserCreateResponse(BaseModel):
    message: str = "The user is well created"


class UserUpdateResponse(BaseModel):
    token_auth: str
    token_expiration: str


class UserDeleteResponse(BaseModel):
    message: str = "The user is well deleted"


class UserLoginModel(BaseModel):
    email: str
    password: str
    code: Optional[str]


class UserLoginResponse(BaseModel):
    token_auth: str
    uuid: str
    token_expiration: str

    def for_login(self):
        return dict(
            token_auth=self.token_auth,
            uuid=self.uuid,
            token_expiration=self.token_expiration,
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

from typing import Optional

from pydantic import BaseModel


class UserCreateModel(BaseModel):
    pseudo: str
    first_name: str
    last_name: str
    email: str
    password: str


class UserCreateResponse(BaseModel):
    message: str = "The user is well created"


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


class InvalidPasswordError(Exception):

    def __init__(self, email: str):
        self.email = email

    def __str__(self):
        return f"Password invalid for user {self.email}"

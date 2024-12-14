from datetime import datetime, timedelta
from typing import Optional

from jose import jwt, JWTError, ExpiredSignatureError
from jose.exceptions import JWTClaimsError
from pydantic import BaseModel

from domain.services.authentication.manager_token import ManagerToken
from domain.user.model.password import Password
from domain.user.model.user import User
from infrastructure.config import Settings

ALGORITHM = 'HS256'


class JwtManagerTokenImpl(ManagerToken, BaseModel):
    settings: Settings

    def generate_token_login(self, user: User) -> str:
        expire = datetime.utcnow() + timedelta(hours=self.settings.access_token_expire_minutes)
        return self.generate_token(user.token_details(), self.settings.secret_key_token, expire)

    def generate_expiration_token_login(self, user: User) -> str:
        expire = datetime.utcnow() + timedelta(hours=self.settings.refresh_token_expire_minutes)
        return self.generate_token(user.token_details(), self.settings.secret_key_token_refresh, expire)

    def decode_token_login(self, token: str) -> Optional[dict]:
        return self.__decode(token, self.settings.secret_key_token)

    def decode_expiration_token_login(self, token: str, password: Password) -> Optional[dict]:
        data = self.__decode(token, self.settings.secret_key_token_refresh)
        if data is None:
            return None

        return data

    @staticmethod
    def generate_token(data: dict, secret_key: str, expires_delta: Optional[datetime] = None) -> str:
        to_encode = data.copy()
        to_encode.update({"exp": expires_delta})
        encoded_jwt = jwt.encode(to_encode, secret_key, algorithm=ALGORITHM)
        return encoded_jwt

    @staticmethod
    def __decode(token: str, secret_key: str) -> Optional[dict]:
        try:
            return jwt.decode(token, secret_key, algorithms=ALGORITHM)
        except(JWTError, ExpiredSignatureError, JWTClaimsError) as e:
            return None

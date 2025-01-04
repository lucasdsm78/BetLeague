import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

import jwt  # PyJWT
from jwt import ExpiredSignatureError, InvalidTokenError, InvalidAudienceError
from pydantic import BaseModel

from domain.services.authentication.manager_token import ManagerToken
from domain.user.model.password import Password
from domain.user.model.user import User
from infrastructure.config import Settings

ALGORITHM = "RS256"


class JwtManagerTokenImpl(ManagerToken, BaseModel):
    settings: Settings

    def generate_token_login(self, user: User) -> str:
        expire = datetime.utcnow() + timedelta(minutes=self.settings.access_token_expire_minutes)
        return self._generate_token(
            data=user.token_details(),
            rsa_key=self.settings.private_key,
            expires_delta=expire
        )

    def generate_expiration_token_login(self, user: User) -> str:
        expire = datetime.utcnow() + timedelta(minutes=self.settings.refresh_token_expire_minutes)
        return self._generate_token(
            data=user.token_details(),
            rsa_key=self.settings.private_key,
            expires_delta=expire
        )

    def decode_token_login(self, token: str) -> Optional[Dict[str, Any]]:
        return self._decode_token(token, self.settings.public_key)

    def decode_expiration_token_login(self, token: str, password: Password) -> Optional[Dict[str, Any]]:
        return self._decode_token(
            token=token,
            rsa_pub_key=self.settings.public_key
        )

    @staticmethod
    def _generate_token(data: dict, rsa_key: str, expires_delta: datetime) -> str:
        payload = data.copy()
        payload["exp"] = expires_delta
        payload["iat"] = datetime.utcnow()

        encoded_jwt = jwt.encode(payload, rsa_key, algorithm=ALGORITHM)  # Utilisation de ALGORITHM
        return encoded_jwt

    @staticmethod
    def _decode_token(token: str, rsa_pub_key: str) -> Optional[Dict[str, Any]]:
        try:
            decoded = jwt.decode(token, rsa_pub_key, algorithms=[ALGORITHM])  # Utilisation de ALGORITHM
            return decoded
        except ExpiredSignatureError:
            logging.warning("Token expiré.")
        except InvalidAudienceError:
            logging.warning("Audience invalide.")
        except InvalidTokenError:
            logging.warning("Token invalide.")
        return None

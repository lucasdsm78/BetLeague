import asyncio
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

    async def generate_token_login(self, user: User) -> str:
        expire = datetime.utcnow() + timedelta(minutes=self.settings.access_token_expire_minutes)
        return await self._generate_token(
            data=user.token_details(),
            rsa_key=self.settings.private_key,
            expires_delta=expire
        )

    async def generate_expiration_token_login(self, user: User) -> str:
        expire = datetime.utcnow() + timedelta(minutes=self.settings.refresh_token_expire_minutes)
        return await self._generate_token(
            data=user.token_details(),
            rsa_key=self.settings.private_key,
            expires_delta=expire
        )

    async def decode_token_login(self, token: str) -> Optional[Dict[str, Any]]:
        return await self._decode_token(token, self.settings.public_key)

    async def decode_expiration_token_login(self, token: str, password: Password) -> Optional[Dict[str, Any]]:
        return await self._decode_token(token, self.settings.public_key)

    @staticmethod
    async def _generate_token(data: dict, rsa_key: str, expires_delta: datetime) -> str:
        payload = data.copy()
        payload.update({
            "exp": expires_delta,
            "iat": datetime.utcnow()
        })
        return await asyncio.to_thread(jwt.encode, payload, rsa_key, ALGORITHM)

    @staticmethod
    async def _decode_token(token: str, rsa_pub_key: str) -> Optional[Dict[str, Any]]:
        try:
            decoded = await asyncio.to_thread(jwt.decode, token, rsa_pub_key, [ALGORITHM])
            return decoded
        except jwt.ExpiredSignatureError:
            logging.warning("Expired token.")
        except jwt.InvalidAudienceError:
            logging.warning("Invalid audience.")
        except jwt.InvalidTokenError:
            logging.warning("Invalid token.")
        return None

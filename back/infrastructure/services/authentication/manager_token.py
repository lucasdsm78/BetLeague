import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import uuid

import jwt  # PyJWT
from jwt import ExpiredSignatureError, InvalidTokenError, InvalidAudienceError
from pydantic import BaseModel

from domain.services.authentication.manager_token import ManagerToken
from domain.user.model.password import Password
from domain.user.model.user import User
from infrastructure.config import Settings
from infrastructure.services.authentication.token_blacklist_impl import get_token_blacklist

ALGORITHM = "RS256"


class JwtManagerTokenImpl(ManagerToken, BaseModel):
    settings: Settings

    async def generate_token_login(self, user: User) -> str:
        expire = datetime.utcnow() + timedelta(minutes=self.settings.access_token_expire_minutes)
        # Add unique JTI (JWT ID) for blacklist tracking
        token_data = user.token_details()
        token_data['jti'] = str(uuid.uuid4())  # Unique token identifier

        return await self._generate_token(
            data=token_data,
            rsa_key=self.settings.private_key,
            expires_delta=expire
        )

    async def generate_expiration_token_login(self, user: User) -> str:
        expire = datetime.utcnow() + timedelta(minutes=self.settings.refresh_token_expire_minutes)
        # Add unique JTI for refresh token too
        token_data = user.token_details()
        token_data['jti'] = str(uuid.uuid4())  # Unique token identifier
        token_data['type'] = 'refresh'  # Mark as refresh token

        return await self._generate_token(
            data=token_data,
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

    async def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        try:
            blacklist = get_token_blacklist()
            if await blacklist.is_token_blacklisted(token):
                logging.warning("🚫 Attempted use of blacklisted token")
                return None

            decoded = await self._decode_token(token, self.settings.public_key)
            return decoded

        except Exception as e:
            logging.error(f"🚨 Token verification error: {e}")
            return None

    async def invalidate_token(self, token: str, user_id: str) -> bool:
        try:
            decoded = await self._decode_token(token, self.settings.public_key)
            if not decoded:
                return False

            expires_at = datetime.fromtimestamp(decoded.get('exp', 0))

            blacklist = get_token_blacklist()
            success = await blacklist.blacklist_token(token, user_id, expires_at)

            if success:
                logging.info(f"🔒 Token invalidated for user {user_id}")

            return success

        except Exception as e:
            logging.error(f"🚨 Failed to invalidate token: {e}")
            return False

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

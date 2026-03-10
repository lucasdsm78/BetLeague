import asyncio
import logging
from datetime import datetime, timedelta, UTC
from typing import Optional, Dict, Any
import uuid
import time

import jwt  # PyJWT
from jwt import ExpiredSignatureError, InvalidTokenError, InvalidAudienceError
from pydantic import BaseModel

from domain.services.authentication.manager_token import ManagerToken
from domain.services.authentication.token_blacklist import TokenBlacklistService
from domain.user.model.password import Password
from domain.user.model.user import User
from infrastructure.config import Settings

ALGORITHM = "RS256"


class JwtManagerTokenImpl(ManagerToken, BaseModel):
    settings: Settings
    blacklist: TokenBlacklistService

    async def generate_token_login(self, user: User) -> str:
        expire = datetime.now(UTC) + timedelta(minutes=self.settings.access_token_expire_minutes)
        # Add unique JTI (JWT ID) for blacklist tracking
        token_data = user.token_details()
        token_data['jti'] = str(uuid.uuid4())  # Unique token identifier

        return await self._generate_token(
            data=token_data,
            rsa_key=self.settings.private_key,
            expires_delta=expire
        )

    async def generate_expiration_token_login(self, user: User) -> str:
        expire = datetime.now(UTC) + timedelta(minutes=self.settings.refresh_token_expire_minutes)
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
            "exp": int(expires_delta.timestamp()),
            "iat": int(datetime.now(UTC).timestamp()),
        })
        return await asyncio.to_thread(jwt.encode, payload, rsa_key, ALGORITHM)

    async def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        try:
            blacklist = self.blacklist
            if await blacklist.is_token_blacklisted(token):
                logging.warning("🚫 Attempted use of blacklisted token")
                return None

            decoded = await self._decode_token(token, self.settings.public_key)
            if not decoded:
                return None

            user_id = decoded.get("id")
            issued_at = decoded.get("iat")
            # fail-closed: on exige ces champs, sinon bypass possible de la révocation globale
            if user_id is None or issued_at is None:
                logging.warning("🚫 Token missing required claims (id/iat)")
                return None

            issued_at_dt = datetime.fromtimestamp(int(issued_at), tz=UTC)

            if await blacklist.is_token_globally_invalidated(
                user_id=str(user_id),
                token_issued_at=issued_at_dt,
            ):
                logging.warning("🚫 Token globally invalidated for user")
                return None

            return decoded

        except Exception as e:
            logging.error(f"🚨 Token verification error: {e}")
            return None

    async def invalidate_token(self, token: str, user_id: str) -> bool:
        try:
            decoded = await self._decode_token(token, self.settings.public_key)
            if not decoded:
                return False

            exp = decoded.get('exp', 0)
            expires_at = datetime.fromtimestamp(int(exp), tz=UTC)

            blacklist = self.blacklist
            success = await blacklist.blacklist_token(token, user_id, expires_at)

            if success:
                logging.info(f"🔒 Token invalidated for user {user_id}")

            return success

        except Exception as e:
            logging.error(f"🚨 Failed to invalidate token: {e}")
            return False

    async def invalidate_all_user_tokens(self, user_id: str) -> bool:
        try:
            blacklist = self.blacklist
            return await blacklist.blacklist_user_tokens_before(
                user_id=str(user_id),
                invalid_before=datetime.now(UTC),
            )
        except Exception as e:
            logging.error(f"🚨 Failed to globally invalidate tokens: {e}")
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

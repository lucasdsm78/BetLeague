import asyncio
import logging
from datetime import datetime, timedelta, UTC
from typing import Optional, Dict, Any
import uuid

import jwt  # PyJWT
from jwt import ExpiredSignatureError, InvalidTokenError, InvalidAudienceError
from pydantic import BaseModel, ConfigDict

from domain.services.authentication.manager_token import ManagerToken
from domain.services.authentication.token_blacklist import TokenBlacklistService
from domain.user.model.password import Password
from domain.user.model.user import User
from infrastructure.config import Settings

ALGORITHM = "RS256"
logger = logging.getLogger(__name__)


class JwtManagerTokenImpl(ManagerToken, BaseModel):
    settings: Settings
    blacklist: TokenBlacklistService

    model_config = ConfigDict(arbitrary_types_allowed=True)

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
                logger.warning("Tentative d'utilisation d'un token blacklisté")
                return None

            decoded = await self._decode_token(token, self.settings.public_key)
            if not decoded:
                return None

            user_id = decoded.get("id")
            issued_at = decoded.get("iat")
            # fail-closed: on exige ces champs, sinon bypass possible de la révocation globale
            if user_id is None or issued_at is None:
                logger.warning("Token rejeté: claims obligatoires manquants (id/iat)")
                return None

            issued_at_dt = datetime.fromtimestamp(int(issued_at), tz=UTC)

            if await blacklist.is_token_globally_invalidated(
                user_id=str(user_id),
                token_issued_at=issued_at_dt,
            ):
                logger.warning("Token rejeté: invalidation globale active pour l'utilisateur")
                return None

            return decoded

        except Exception:
            logger.exception("Erreur lors de la vérification du token")
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
                logger.info("Token invalidé pour l'utilisateur %s", user_id)

            return success

        except Exception:
            logger.exception("Échec de l'invalidation du token pour l'utilisateur %s", user_id)
            return False

    async def invalidate_all_user_tokens(self, user_id: str) -> bool:
        try:
            blacklist = self.blacklist
            return await blacklist.blacklist_user_tokens_before(
                user_id=str(user_id),
                invalid_before=datetime.now(UTC),
            )
        except Exception:
            logger.exception("Échec de l'invalidation globale des tokens pour l'utilisateur %s", user_id)
            return False

    @staticmethod
    async def _decode_token(token: str, rsa_pub_key: str) -> Optional[Dict[str, Any]]:
        try:
            decoded = await asyncio.to_thread(jwt.decode, token, rsa_pub_key, [ALGORITHM])
            return decoded
        except jwt.ExpiredSignatureError:
            logger.warning("Token expiré")
        except jwt.InvalidAudienceError:
            logger.warning("Audience de token invalide")
        except jwt.InvalidTokenError:
            logger.warning("Token invalide")
        return None

from __future__ import annotations

import hmac
import hashlib
import logging
import secrets
from abc import ABC, abstractmethod

import shortuuid
from cryptography.fernet import Fernet
from fastapi import HTTPException

from domain.services.authentication.hash import Hash
from domain.services.authentication.totp_service import TOTPService
from domain.user.exception.password_reset_exception import (
    PasswordResetInvalidCodeError,
    PasswordResetInvalidTokenError,
    PasswordResetRateLimitedError,
)
from domain.user.exception.user_exception import Invalid2FACodeError, UserNotFoundError
from domain.user.model.password import Password
from domain.user.repository.password_reset_repository import PasswordResetRepository
from domain.user.repository.user_repository import UserRepository
from infrastructure.config import Settings


logger = logging.getLogger(__name__)


def _hash_identifier(value: str) -> str:
    normalized = (value or "").strip().lower()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


class PasswordResetUseCase(ABC):
    @abstractmethod
    async def request_reset(self, *, email: str, client_key: str) -> tuple[str, int]:
        raise NotImplementedError

    @abstractmethod
    async def verify_code(self, *, email: str, challenge_id: str, code: str, client_key: str) -> tuple[str, int]:
        raise NotImplementedError

    @abstractmethod
    async def confirm_reset(self, *, email: str, challenge_id: str, reset_token: str, new_password: str) -> None:
        raise NotImplementedError


class PasswordResetUseCaseImpl(PasswordResetUseCase):
    def __init__(
        self,
        *,
        user_repository: UserRepository,
        password_reset_repository: PasswordResetRepository,
        hasher: Hash,
        totp_service: TOTPService,
        settings: Settings,
    ):
        self._users = user_repository
        self._store = password_reset_repository
        self._hasher = hasher
        self._totp = totp_service
        self._settings = settings
        self._cipher_suite = Fernet(self._settings.encryption_key.encode())

        self._otp_len = 6
        self._challenge_ttl_s = int(getattr(self._settings, "password_reset_challenge_ttl_s", 600))
        self._reset_ttl_s = int(getattr(self._settings, "password_reset_token_ttl_s", 600))
        self._rl_window_s = 60
        self._rl_limit = int(getattr(self._settings, "password_reset_rate_limit_per_minute", 5))

    def _hmac_hash(self, *, secret: str, value: str) -> str:
        return hmac.new(secret.encode(), value.encode(), hashlib.sha256).hexdigest()

    async def request_reset(self, *, email: str, client_key: str) -> tuple[str, int]:
        rl_ok = await self._store.incr_rate_limit(
            key=f"req:{client_key}:{email}",
            window_seconds=self._rl_window_s,
            limit=self._rl_limit,
        )
        if not rl_ok:
            logger.warning(
                "auth.password_reset.request_rejected",
                extra={"email_hash": _hash_identifier(email), "client_key": client_key, "reason": "rate_limited"},
            )
            raise PasswordResetRateLimitedError

        if self._challenge_ttl_s <= 0:
            raise HTTPException(status_code=500, detail="Invalid password reset challenge TTL")

        user = await self._users.find_by_email(email)
        if not user:
            logger.info(
                "auth.password_reset.request_neutral",
                extra={"email_hash": _hash_identifier(email), "reason": "user_missing"},
            )
            return shortuuid.uuid(), self._challenge_ttl_s

        if not getattr(user, "is_two_factor_enabled", False) or not getattr(user, "two_factor_secret", None):
            logger.info(
                "auth.password_reset.request_neutral",
                extra={"email_hash": _hash_identifier(email), "user_id": user.id, "reason": "two_factor_not_enabled"},
            )
            return shortuuid.uuid(), self._challenge_ttl_s

        challenge_id = shortuuid.uuid()

        await self._store.create_challenge(
            challenge_id=challenge_id,
            email=email,
            code_hash="totp",  # placeholder; pas utilisé
            expires_in_seconds=self._challenge_ttl_s,
        )
        logger.info(
            "auth.password_reset.challenge_issued",
            extra={"email_hash": _hash_identifier(email), "user_id": user.id, "challenge_id": challenge_id},
        )
        return challenge_id, self._challenge_ttl_s

    async def verify_code(self, *, email: str, challenge_id: str, code: str, client_key: str) -> tuple[str, int]:
        rl_ok = await self._store.incr_rate_limit(
            key=f"ver:{client_key}:{challenge_id}",
            window_seconds=self._rl_window_s,
            limit=self._rl_limit,
        )
        if not rl_ok:
            logger.warning(
                "auth.password_reset.verify_rejected",
                extra={
                    "email_hash": _hash_identifier(email),
                    "challenge_id": challenge_id,
                    "client_key": client_key,
                    "reason": "rate_limited",
                },
            )
            raise PasswordResetRateLimitedError

        user = await self._users.find_by_email(email)
        if not user:
            logger.warning(
                "auth.password_reset.verify_rejected",
                extra={"email_hash": _hash_identifier(email), "challenge_id": challenge_id, "reason": "user_missing"},
            )
            raise UserNotFoundError

        if not getattr(user, "is_two_factor_enabled", False) or not getattr(user, "two_factor_secret", None):
            logger.warning(
                "auth.password_reset.verify_rejected",
                extra={"email_hash": _hash_identifier(email), "user_id": user.id, "challenge_id": challenge_id, "reason": "two_factor_not_enabled"},
            )
            raise PasswordResetInvalidCodeError

        challenge = await self._store.get_challenge(challenge_id=challenge_id)
        if not challenge or challenge.get("email") != email:
            logger.warning(
                "auth.password_reset.verify_rejected",
                extra={"email_hash": _hash_identifier(email), "user_id": user.id, "challenge_id": challenge_id, "reason": "challenge_not_found"},
            )
            raise PasswordResetInvalidCodeError

        secret = await self._totp.decrypt_secret(user.two_factor_secret, self._cipher_suite)
        if len(code) != 6 or not code.isdigit():
            logger.warning(
                "auth.password_reset.verify_rejected",
                extra={"email_hash": _hash_identifier(email), "user_id": user.id, "challenge_id": challenge_id, "reason": "invalid_code_format"},
            )
            raise Invalid2FACodeError
        if not await self._totp.verify_code(secret, code):
            logger.warning(
                "auth.password_reset.verify_rejected",
                extra={"email_hash": _hash_identifier(email), "user_id": user.id, "challenge_id": challenge_id, "reason": "invalid_code"},
            )
            raise Invalid2FACodeError

        reset_token = secrets.token_urlsafe(32)
        reset_token_hash = self._hmac_hash(secret=self._settings.secret_key_token_refresh, value=f"{challenge_id}:{reset_token}")
        await self._store.mark_challenge_verified(
            challenge_id=challenge_id,
            reset_token_hash=reset_token_hash,
            reset_expires_in_seconds=self._reset_ttl_s,
        )
        logger.info(
            "auth.password_reset.token_issued",
            extra={"email_hash": _hash_identifier(email), "user_id": user.id, "challenge_id": challenge_id},
        )
        return reset_token, self._reset_ttl_s

    async def confirm_reset(self, *, email: str, challenge_id: str, reset_token: str, new_password: str) -> None:
        user = await self._users.find_by_email(email)
        if not user:
            logger.warning(
                "auth.password_reset.confirm_rejected",
                extra={"email_hash": _hash_identifier(email), "challenge_id": challenge_id, "reason": "user_missing"},
            )
            raise PasswordResetInvalidTokenError

        reset_token_hash = self._hmac_hash(secret=self._settings.secret_key_token_refresh, value=f"{challenge_id}:{reset_token}")
        consumed = await self._store.consume_reset_token(
            challenge_id=challenge_id,
            reset_token_hash=reset_token_hash,
        )
        if not consumed or consumed.get("email") != email:
            logger.warning(
                "auth.password_reset.confirm_rejected",
                extra={"email_hash": _hash_identifier(email), "user_id": user.id, "challenge_id": challenge_id, "reason": "invalid_token"},
            )
            raise PasswordResetInvalidTokenError

        if len(new_password) < 8:
            logger.warning(
                "auth.password_reset.confirm_rejected",
                extra={"email_hash": _hash_identifier(email), "user_id": user.id, "challenge_id": challenge_id, "reason": "password_too_short"},
            )
            raise HTTPException(status_code=400, detail="Password too short")

        hashed = await self._hasher.bcrypt(new_password)

        user.password = Password(password=hashed)

        await self._users.update(user)
        await self._users.commit()
        logger.info(
            "auth.password_reset.confirmed",
            extra={"email_hash": _hash_identifier(email), "user_id": user.id, "challenge_id": challenge_id},
        )

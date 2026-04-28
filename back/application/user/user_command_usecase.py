import asyncio
import base64
import hashlib
import logging
from abc import ABC, abstractmethod
from typing import Callable, Optional

import shortuuid
from cryptography.fernet import Fernet
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta, UTC

from application.user.user_command_model import (
    UserCreateModel, UserCreateResponse, UserLoginResponse, UserLoginModel,
    InvalidPasswordError, UserDeleteResponse, UserUpdateModel,
    UserUpdateResponse, RefreshTokenResponse, DeleteMyAccountModel,
    ChangeMyPasswordModel, ChangeMyPasswordResponse,
    TwoFactorSetupResponse, TwoFactorStatusResponse,
    VerifyTwoFactorModel, DisableTwoFactorModel, DisableTwoFactorResponse,
)
from domain.services.authentication.hash import Hash
from domain.services.authentication.manager_token import ManagerToken
from domain.services.authentication.totp_service import TOTPService
from domain.user.exception.user_exception import (
    UserNotFoundError, UserLoginNotFoundError, UserEmailAlreadyExistsError,
    UserPseudoAlreadyExistsError, FARequiredError, Invalid2FACodeError
)
from domain.user.model.email import Email
from domain.user.model.password import Password
from domain.user.model.user import User
from domain.user.repository.user_repository import UserRepository
from infrastructure.config import Settings
from infrastructure.postgresql.user.user_repository import UserRepositoryImpl

logger = logging.getLogger(__name__)

# Helper pour formater un datetime UTC avec suffixe 'Z'
def _utc_iso_z(dt: datetime) -> str:
    return dt.replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def _hash_identifier(value: str) -> str:
    normalized = (value or "").strip().lower()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _auth_usecase_extra(*, email: str | None = None, user: User | None = None, **extra) -> dict:
    payload = {"layer": "use_case", **extra}
    if email:
        payload["email_hash"] = _hash_identifier(email)
    if user is not None:
        payload["user_id"] = getattr(user, "id", None)
        payload["user_uuid"] = getattr(user, "uuid", None)
        payload["two_factor_enabled"] = bool(getattr(user, "is_two_factor_enabled", False))
    return {key: value for key, value in payload.items() if value is not None}


def _log_auth_usecase(level: int, event: str, *, email: str | None = None, user: User | None = None, **extra) -> None:
    logger.log(level, event, extra=_auth_usecase_extra(email=email, user=user, **extra))

class UserCommandUseCase(ABC):

    @abstractmethod
    async def create(self, user_create_model: UserCreateModel) -> UserCreateResponse:
        raise NotImplementedError

    @abstractmethod
    async def login(self, user_login_model: UserLoginModel) -> UserLoginResponse:
        raise NotImplementedError

    @abstractmethod
    async def delete_current_user(self, email: str, token: str, data: DeleteMyAccountModel) -> UserDeleteResponse:
        raise NotImplementedError

    @abstractmethod
    async def update_user_profile(self, email: str, data: UserUpdateModel):
        raise NotImplementedError

    @abstractmethod
    async def enable_2fa(self, email: str) -> TwoFactorSetupResponse:
        raise NotImplementedError

    @abstractmethod
    async def verify_2fa(self, email: str, data: VerifyTwoFactorModel, attempts_remaining: Optional[int] = None) -> TwoFactorStatusResponse:
        raise NotImplementedError

    @abstractmethod
    async def disable_2fa(self, email: str, token: str, data: DisableTwoFactorModel) -> DisableTwoFactorResponse:
        raise NotImplementedError

    @abstractmethod
    async def refresh_token(self, refresh_token: str) -> RefreshTokenResponse:
        raise NotImplementedError

    @abstractmethod
    async def logout(self, user_id: str, token: str) -> dict:
        raise NotImplementedError

    @abstractmethod
    async def change_my_password(self, email: str, token: str, data: ChangeMyPasswordModel) -> ChangeMyPasswordResponse:
        raise NotImplementedError


class UserCommandUseCaseImpl(UserCommandUseCase):

    def __init__(
            self,
            user_repository: UserRepository,
            hasher: Hash,
            session_factory: Callable[[], AsyncSession],
            manager_token: ManagerToken,
            totp_service: TOTPService,
            settings: Settings
    ):
        self.user_repository: UserRepository = user_repository
        self.hasher = hasher
        self._session_factory = session_factory
        self.manager_token = manager_token
        self.totp_service = totp_service
        self.settings = settings
        self.cipher_suite = Fernet(self.settings.encryption_key.encode())

    async def create(self, data: UserCreateModel) -> UserCreateResponse:
        async with self._session_factory() as session:
            async with session.begin():
                repo = UserRepositoryImpl(session)
                if await repo.find_by_email(data.email):
                    await self.hasher.bcrypt(data.password)
                    logger.info(
                        "auth.register.duplicate_neutral",
                        extra={"email_hash": _hash_identifier(data.email)},
                    )
                    return UserCreateResponse()
                hashed = await self.hasher.bcrypt(data.password)
                user = User(
                    email=Email(data.email),
                    pseudo=data.pseudo,
                    uuid=shortuuid.uuid(),
                    password=Password(hashed)
                )
                await repo.create(user)
                logger.info(
                    "auth.register.succeeded",
                    extra={
                        "user_uuid": user.uuid,
                        "email_hash": _hash_identifier(data.email),
                    },
                )
        return UserCreateResponse()

    async def login(self, model: UserLoginModel) -> UserLoginResponse:
        async with self._session_factory() as session:
            async with session.begin():
                repo = UserRepositoryImpl(session)
                user = await repo.find_by_email(model.email)
                if not user:
                    _log_auth_usecase(
                        logging.WARNING,
                        "auth.login.failed",
                        email=model.email,
                        reason="invalid_credentials",
                    )
                    raise UserLoginNotFoundError(model.email)
                if not await self.hasher.verify(model.password, user.password.password):
                    _log_auth_usecase(
                        logging.WARNING,
                        "auth.login.failed",
                        email=model.email,
                        user=user,
                        reason="invalid_credentials",
                    )
                    raise InvalidPasswordError(model.email)
                if user.is_two_factor_enabled:
                    if not model.code:
                        _log_auth_usecase(
                            logging.INFO,
                            "auth.login.challenge_required",
                            email=model.email,
                            user=user,
                            reason="two_factor_required",
                        )
                        raise FARequiredError()
                    if not user.two_factor_secret:
                        raise HTTPException(status_code=500, detail="2FA secret missing for user")
                    secret = await self.totp_service.decrypt_secret(user.two_factor_secret, self.cipher_suite)
                    if len(model.code) != 6 or not model.code.isdigit():
                        _log_auth_usecase(
                            logging.WARNING,
                            "auth.login.failed",
                            email=model.email,
                            user=user,
                            reason="invalid_2fa_code_format",
                        )
                        raise Invalid2FACodeError()
                    if not await self.totp_service.verify_code(secret, model.code):
                        _log_auth_usecase(
                            logging.WARNING,
                            "auth.login.failed",
                            email=model.email,
                            user=user,
                            reason="invalid_2fa_code",
                        )
                        raise Invalid2FACodeError()
        token_coro = self.manager_token.generate_token_login(user)
        refresh_coro = self.manager_token.generate_expiration_token_login(user)
        token, refresh = await asyncio.gather(token_coro, refresh_coro)
        expiration_time = datetime.now(UTC) + timedelta(minutes=self.settings.access_token_expire_minutes)
        _log_auth_usecase(
            logging.INFO,
            "auth.login.succeeded",
            email=model.email,
            user=user,
        )
        return UserLoginResponse(
            uuid=user.uuid,
            token_auth=token,
            refresh_token=refresh,
            token_expiration=_utc_iso_z(expiration_time),
            two_factor_enabled=user.is_two_factor_enabled,
        )

    async def delete_current_user(self, email: str, token: str, data: DeleteMyAccountModel) -> UserDeleteResponse:
        user = await self.user_repository.find_by_email(email)
        if not user:
            _log_auth_usecase(
                logging.WARNING,
                "auth.account.delete_rejected",
                email=email,
                reason="user_missing",
            )
            raise UserNotFoundError

        if not await self.hasher.verify(data.current_password, user.password.password):
            _log_auth_usecase(
                logging.WARNING,
                "auth.account.delete_rejected",
                email=email,
                user=user,
                reason="invalid_password",
            )
            raise InvalidPasswordError(email)

        if user.is_two_factor_enabled:
            if not data.two_fa_code:
                _log_auth_usecase(
                    logging.INFO,
                    "auth.account.delete_rejected",
                    email=email,
                    user=user,
                    reason="two_factor_required",
                )
                raise FARequiredError()
            if not user.two_factor_secret:
                raise HTTPException(status_code=500, detail="2FA secret missing for user")
            secret = await self.totp_service.decrypt_secret(user.two_factor_secret, self.cipher_suite)
            if not data.two_fa_code.isdigit():
                _log_auth_usecase(
                    logging.WARNING,
                    "auth.account.delete_rejected",
                    email=email,
                    user=user,
                    reason="invalid_2fa_code_format",
                )
                raise Invalid2FACodeError()
            if not await self.totp_service.verify_code(secret, data.two_fa_code):
                _log_auth_usecase(
                    logging.WARNING,
                    "auth.account.delete_rejected",
                    email=email,
                    user=user,
                    reason="invalid_2fa_code",
                )
                raise Invalid2FACodeError()

        deleted_at = int(datetime.now(UTC).timestamp() * 1000)
        anonymized_email = f"deleted{user.id}.{deleted_at}@deletedlocal.com"
        anonymized_pseudo = f"deleted-user-{user.id}-{deleted_at}"
        hashed_password = await self.hasher.bcrypt(shortuuid.uuid())
        user.mark_as_deleted(
            anonymized_email=anonymized_email,
            anonymized_pseudo=anonymized_pseudo,
            hashed_password=hashed_password,
            new_uuid=shortuuid.uuid(),
            deleted_at=deleted_at,
            auth_revoked_at=int(datetime.now(UTC).timestamp()),
        )

        try:
            await self.user_repository.update(user)
            await self.user_repository.commit()
        except Exception:
            await self.user_repository.rollback()
            raise

        await self.manager_token.invalidate_token(token, str(user.id))
        await self.manager_token.invalidate_all_user_tokens(str(user.id))
        _log_auth_usecase(logging.INFO, "auth.account.deleted", email=email, user=user)
        return UserDeleteResponse()

    async def enable_2fa(self, email: str) -> TwoFactorSetupResponse:
        async with self._session_factory() as session:
            async with session.begin():
                repo = UserRepositoryImpl(session)
                user = await repo.find_by_email(email)
                if not user:
                    _log_auth_usecase(
                        logging.WARNING,
                        "auth.2fa.setup_rejected",
                        email=email,
                        reason="user_missing",
                    )
                    raise UserNotFoundError
                if user.is_two_factor_enabled:
                    _log_auth_usecase(
                        logging.INFO,
                        "auth.2fa.setup_rejected",
                        email=email,
                        user=user,
                        reason="already_enabled",
                    )
                    raise HTTPException(status_code=400, detail={"message": "2FA déjà activée.", "code": "TWO_FACTOR_ALREADY_ENABLED"})
                secret = await self.totp_service.generate_secret()
                encrypted = await self.totp_service.encrypt_secret(secret, self.cipher_suite)
                user.begin_two_factor_setup(encrypted)
                await repo.update(user)
        _log_auth_usecase(logging.INFO, "auth.2fa.setup_started", email=email, user=user)
        otpauth_url = await self.totp_service.get_totp_uri(secret, user.email.value, "BetLeague")
        qr_code_bytes = await self.totp_service.generate_qr_code(otpauth_url)
        qr_code_data_url = f"data:image/png;base64,{base64.b64encode(qr_code_bytes).decode('ascii')}"
        return TwoFactorSetupResponse(
            qr_code=qr_code_data_url,
            secret=secret,
            otpauth_url=otpauth_url,
            message="Scannez le QR code puis confirmez avec un code à 6 chiffres.",
        )

    async def verify_2fa(self, email: str, data: VerifyTwoFactorModel, attempts_remaining: Optional[int] = None) -> TwoFactorStatusResponse:
        async with self._session_factory() as session:
            async with session.begin():
                repo = UserRepositoryImpl(session)
                user = await repo.find_by_email(email)
                if not user:
                    _log_auth_usecase(
                        logging.WARNING,
                        "auth.2fa.verify_rejected",
                        email=email,
                        reason="user_missing",
                        attempts_remaining=attempts_remaining,
                    )
                    raise UserNotFoundError
                if user.is_two_factor_enabled:
                    _log_auth_usecase(
                        logging.INFO,
                        "auth.2fa.verify_rejected",
                        email=email,
                        user=user,
                        reason="already_enabled",
                        attempts_remaining=attempts_remaining,
                    )
                    raise HTTPException(status_code=400, detail={"message": "2FA déjà activée.", "code": "TWO_FACTOR_ALREADY_ENABLED", "attempts_remaining": attempts_remaining})
                if not user.two_factor_secret:
                    _log_auth_usecase(
                        logging.INFO,
                        "auth.2fa.verify_rejected",
                        email=email,
                        user=user,
                        reason="setup_required",
                        attempts_remaining=attempts_remaining,
                    )
                    raise HTTPException(status_code=400, detail={"message": "Aucune configuration 2FA en attente.", "code": "TWO_FACTOR_SETUP_REQUIRED", "attempts_remaining": attempts_remaining})
                secret = await self.totp_service.decrypt_secret(user.two_factor_secret, self.cipher_suite)
                valid = await self.totp_service.verify_code(secret, data.code)
                if not valid:
                    _log_auth_usecase(
                        logging.WARNING,
                        "auth.2fa.verify_rejected",
                        email=email,
                        user=user,
                        reason="invalid_code",
                        attempts_remaining=attempts_remaining,
                    )
                    raise Invalid2FACodeError()
                user.confirm_two_factor_setup()
                await repo.update(user)
        _log_auth_usecase(
            logging.INFO,
            "auth.2fa.verified",
            email=email,
            user=user,
            attempts_remaining=attempts_remaining,
        )
        return TwoFactorStatusResponse(
            enabled=True,
            message="Authentification à deux facteurs activée avec succès.",
            attempts_remaining=attempts_remaining,
        )

    async def disable_2fa(self, email: str, token: str, data: DisableTwoFactorModel) -> DisableTwoFactorResponse:
        async with self._session_factory() as session:
            async with session.begin():
                repo = UserRepositoryImpl(session)
                user = await repo.find_by_email(email)
                if not user:
                    _log_auth_usecase(
                        logging.WARNING,
                        "auth.2fa.disable_rejected",
                        email=email,
                        reason="user_missing",
                    )
                    raise UserNotFoundError
                if not user.is_two_factor_enabled or not user.two_factor_secret:
                    _log_auth_usecase(
                        logging.INFO,
                        "auth.2fa.disable_rejected",
                        email=email,
                        user=user,
                        reason="not_enabled",
                    )
                    raise HTTPException(status_code=400, detail={"message": "2FA non activée.", "code": "TWO_FACTOR_NOT_ENABLED"})
                if not await self.hasher.verify(data.current_password, user.password.password):
                    _log_auth_usecase(
                        logging.WARNING,
                        "auth.2fa.disable_rejected",
                        email=email,
                        user=user,
                        reason="invalid_password",
                    )
                    raise InvalidPasswordError(email)
                secret = await self.totp_service.decrypt_secret(user.two_factor_secret, self.cipher_suite)
                if not await self.totp_service.verify_code(secret, data.code):
                    _log_auth_usecase(
                        logging.WARNING,
                        "auth.2fa.disable_rejected",
                        email=email,
                        user=user,
                        reason="invalid_2fa_code",
                    )
                    raise Invalid2FACodeError()
                user.disable_two_factor()
                await repo.update(user)
        await self.manager_token.invalidate_token(token, str(user.id))
        await self.manager_token.invalidate_all_user_tokens(str(user.id))
        _log_auth_usecase(logging.INFO, "auth.2fa.disabled", email=email, user=user, reauth_required=True)
        return DisableTwoFactorResponse()

    async def update_user_profile(
            self, email: str, data: UserUpdateModel
    ) -> UserUpdateResponse:
        email_changed = False
        async with self._session_factory() as session:
            async with session.begin():
                repo = UserRepositoryImpl(session)

                user = await repo.find_by_email(email)
                if not user:
                    raise UserNotFoundError

                if user.is_two_factor_enabled:
                    if not data.two_fa_code:
                        raise FARequiredError
                    if not user.two_factor_secret:
                        raise HTTPException(status_code=500, detail="2FA secret missing for user")
                    secret = await self.totp_service.decrypt_secret(
                        user.two_factor_secret, self.cipher_suite
                    )
                    if not await self.totp_service.verify_code(secret, data.two_fa_code):
                        raise Invalid2FACodeError

                if data.email and data.email != user.email.value:
                    if not data.current_password:
                        raise HTTPException(status_code=400, detail={"message": "Le mot de passe actuel est requis.", "code": "CURRENT_PASSWORD_REQUIRED"})
                    if not await self.hasher.verify(data.current_password, user.password.password):
                        raise InvalidPasswordError(email)

                to_check = {}
                if data.pseudo and data.pseudo != user.pseudo:
                    to_check['pseudo'] = data.pseudo
                if data.email and data.email != user.email.value:
                    to_check['email'] = data.email

                if to_check:
                    existing = await repo.find_by_pseudo_or_email(**to_check)
                    if existing:
                        if existing.pseudo == to_check.get('pseudo'):
                            raise UserPseudoAlreadyExistsError
                        if existing.email == to_check.get('email'):
                            raise UserEmailAlreadyExistsError
                    if 'pseudo' in to_check:
                        user.pseudo = to_check['pseudo']
                    if 'email' in to_check:
                        user.email = Email(to_check['email'])
                        email_changed = True

                await repo.update(user)

        if email_changed:
            await self.manager_token.invalidate_all_user_tokens(str(user.id))

        token_coro   = self.manager_token.generate_token_login(user)
        refresh_coro = self.manager_token.generate_expiration_token_login(user)
        token, refresh = await asyncio.gather(token_coro, refresh_coro)
        expiration_time = datetime.now(UTC) + timedelta(minutes=self.settings.access_token_expire_minutes)

        return UserUpdateResponse(token_auth=token, refresh_token=refresh, token_expiration=_utc_iso_z(expiration_time))

    async def refresh_token(self, refresh_token: str) -> RefreshTokenResponse:
        try:
            payload = await self.manager_token.verify_token(refresh_token)
            if not payload:
                raise HTTPException(
                    status_code=401,
                    detail="Invalid or expired refresh token"
                )

            if payload.get("type") != "refresh":
                raise HTTPException(
                    status_code=401,
                    detail="Invalid refresh token type"
                )

            user_email = payload.get("email") or payload.get("sub")
            user_id = payload.get("id")
            if not user_email:
                raise HTTPException(
                    status_code=401,
                    detail="Invalid token payload"
                )
            if user_id is None:
                raise HTTPException(
                    status_code=401,
                    detail="Invalid token payload"
                )

            async with self._session_factory() as session:
                async with session.begin():
                    repo = UserRepositoryImpl(session)
                    user = await repo.find_by_email(user_email)
                    if not user:
                        raise HTTPException(
                            status_code=401,
                            detail="User not found"
                        )

            await self.manager_token.invalidate_token(refresh_token, str(user_id))

            token_coro = self.manager_token.generate_token_login(user)
            refresh_coro = self.manager_token.generate_expiration_token_login(user)
            new_token, new_refresh = await asyncio.gather(token_coro, refresh_coro)

            expiration_time = datetime.now(UTC) + timedelta(minutes=self.settings.access_token_expire_minutes)

            return RefreshTokenResponse(
                token_auth=new_token,
                refresh_token=new_refresh,
                token_expiration=_utc_iso_z(expiration_time),
                message="Token refreshed successfully"
            )

        except HTTPException:
            raise
        except Exception:
            raise HTTPException(
                status_code=401,
                detail="Token refresh failed"
            )

    async def logout(self, user_id: str, token: str) -> dict:
        try:
            success = await self.manager_token.invalidate_token(token, user_id)

            if success:
                _log_auth_usecase(
                    logging.INFO,
                    "auth.logout.succeeded",
                    user_id=user_id,
                )
                return {
                    "message": "Déconnexion réussie",
                    "timestamp": _utc_iso_z(datetime.now(UTC)),
                    "user_id": user_id
                }
            else:
                _log_auth_usecase(
                    logging.WARNING,
                    "auth.logout.failed",
                    user_id=user_id,
                    reason="invalidate_token_failed",
                )
                raise HTTPException(
                    status_code=500,
                    detail="Erreur lors de l'invalidation du token"
                )

        except HTTPException:
            raise
        except Exception:
            _log_auth_usecase(
                logging.ERROR,
                "auth.logout.failed",
                user_id=user_id,
                reason="unexpected_error",
            )
            raise HTTPException(
                status_code=500,
                detail="Erreur lors de la déconnexion"
            )

    async def change_my_password(self, email: str, token: str, data: ChangeMyPasswordModel) -> ChangeMyPasswordResponse:
        user = await self.user_repository.find_by_email(email)
        if not user:
            _log_auth_usecase(
                logging.WARNING,
                "auth.password_change_rejected",
                email=email,
                reason="user_missing",
            )
            raise UserNotFoundError

        if not await self.hasher.verify(data.current_password, user.password.password):
            _log_auth_usecase(
                logging.WARNING,
                "auth.password_change_rejected",
                email=email,
                user=user,
                reason="invalid_password",
            )
            raise InvalidPasswordError(email)

        if data.current_password == data.new_password:
            _log_auth_usecase(
                logging.WARNING,
                "auth.password_change_rejected",
                email=email,
                user=user,
                reason="same_password",
            )
            raise HTTPException(status_code=400, detail={"message": "Mot de passe invalide.", "code": "INVALID_PASSWORD"})

        if user.is_two_factor_enabled:
            if not data.two_fa_code:
                _log_auth_usecase(
                    logging.INFO,
                    "auth.password_change_challenge_required",
                    email=email,
                    user=user,
                    reason="two_factor_required",
                )
                raise FARequiredError()
            if not user.two_factor_secret:
                raise HTTPException(status_code=500, detail="2FA secret missing for user")
            secret = await self.totp_service.decrypt_secret(user.two_factor_secret, self.cipher_suite)
            if not data.two_fa_code.isdigit():
                _log_auth_usecase(
                    logging.WARNING,
                    "auth.password_change_rejected",
                    email=email,
                    user=user,
                    reason="invalid_2fa_code_format",
                )
                raise Invalid2FACodeError()
            if not await self.totp_service.verify_code(secret, data.two_fa_code):
                _log_auth_usecase(
                    logging.WARNING,
                    "auth.password_change_rejected",
                    email=email,
                    user=user,
                    reason="invalid_2fa_code",
                )
                raise Invalid2FACodeError()

        new_hash = await self.hasher.bcrypt(data.new_password)
        user.password = Password(new_hash)

        try:
            await self.user_repository.update(user)
            await self.user_repository.commit()
        except Exception:
            await self.user_repository.rollback()
            raise

        await self.manager_token.invalidate_token(token, str(user.id))
        await self.manager_token.invalidate_all_user_tokens(str(user.id))
        _log_auth_usecase(logging.INFO, "auth.password_changed", email=email, user=user, reauth_required=True)

        return ChangeMyPasswordResponse()

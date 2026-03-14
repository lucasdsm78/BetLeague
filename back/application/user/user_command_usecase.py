import asyncio
from abc import ABC, abstractmethod
from typing import Callable

import shortuuid
from cryptography.fernet import Fernet
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta, UTC

from application.user.user_command_model import (
    UserCreateModel, UserLoginResponse, UserLoginModel,
    InvalidPasswordError, UserDeleteResponse, UserUpdateModel,
    UserUpdateResponse, RefreshTokenResponse, DeleteMyAccountModel,
    ChangeMyPasswordModel, ChangeMyPasswordResponse,
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

# Helper pour formater un datetime UTC avec suffixe 'Z'
def _utc_iso_z(dt: datetime) -> str:
    return dt.replace(microsecond=0).isoformat().replace('+00:00', 'Z')

class UserCommandUseCase(ABC):

    @abstractmethod
    async def create(self, user_create_model: UserCreateModel) -> UserLoginResponse:
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
    async def enable_2fa(self, email: str) -> bytes:
        raise NotImplementedError

    @abstractmethod
    async def verify_2fa(self, email: str, code: str) -> bool:
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

    async def create(self, data: UserCreateModel) -> UserLoginResponse:
        async with self._session_factory() as session:
            async with session.begin():
                repo = UserRepositoryImpl(session)
                if await repo.find_by_email(data.email):
                    raise UserEmailAlreadyExistsError
                hashed = await self.hasher.bcrypt(data.password)
                user = User(
                    email=Email(data.email),
                    pseudo=data.pseudo,
                    uuid=shortuuid.uuid(),
                    password=Password(hashed)
                )
                await repo.create(user)
        token_coro = self.manager_token.generate_token_login(user)
        refresh_coro = self.manager_token.generate_expiration_token_login(user)
        token, refresh = await asyncio.gather(token_coro, refresh_coro)
        expiration_time = datetime.now(UTC) + timedelta(minutes=self.settings.access_token_expire_minutes)
        return UserLoginResponse(
            uuid=user.uuid,
            token_auth=token,
            refresh_token=refresh,
            token_expiration=_utc_iso_z(expiration_time),
        )

    async def login(self, model: UserLoginModel) -> UserLoginResponse:
        async with self._session_factory() as session:
            async with session.begin():
                repo = UserRepositoryImpl(session)
                user = await repo.find_by_email(model.email)
                if not user:
                    raise UserLoginNotFoundError(model.email)
                if not await self.hasher.verify(model.password, user.password.password):
                    raise InvalidPasswordError(model.email)
                if user.is_two_factor_enabled:
                    if not model.code:
                        raise FARequiredError()
                    if not user.two_factor_secret:
                        raise HTTPException(status_code=500, detail="2FA secret missing for user")
                    secret = await self.totp_service.decrypt_secret(user.two_factor_secret, self.cipher_suite)
                    if len(model.code) != 6 or not model.code.isdigit():
                        raise Invalid2FACodeError()
                    if not await self.totp_service.verify_code(secret, model.code):
                        raise Invalid2FACodeError()
        token_coro = self.manager_token.generate_token_login(user)
        refresh_coro = self.manager_token.generate_expiration_token_login(user)
        token, refresh = await asyncio.gather(token_coro, refresh_coro)
        expiration_time = datetime.now(UTC) + timedelta(minutes=self.settings.access_token_expire_minutes)
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
            raise UserNotFoundError

        if not await self.hasher.verify(data.current_password, user.password.password):
            raise InvalidPasswordError(email)

        if user.is_two_factor_enabled:
            if not data.two_fa_code:
                raise FARequiredError()
            if not user.two_factor_secret:
                raise HTTPException(status_code=500, detail="2FA secret missing for user")
            secret = await self.totp_service.decrypt_secret(user.two_factor_secret, self.cipher_suite)
            if not data.two_fa_code.isdigit():
                raise Invalid2FACodeError()
            if not await self.totp_service.verify_code(secret, data.two_fa_code):
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
        return UserDeleteResponse()

    async def enable_2fa(self, email: str) -> bytes:
        async with self._session_factory() as session:
            async with session.begin():
                repo = UserRepositoryImpl(session)
                user = await repo.find_by_email(email)
                if not user:
                    raise UserNotFoundError
                if user.is_two_factor_enabled:
                    raise HTTPException(status_code=400, detail="2FA already enabled.")
                secret = await self.totp_service.generate_secret()
                encrypted = await self.totp_service.encrypt_secret(secret, self.cipher_suite)
                user.two_factor_secret = encrypted
                user.is_two_factor_enabled = True
                await repo.update(user)
        uri = await self.totp_service.get_totp_uri(secret, user.email.value, "BetLeague")
        return await self.totp_service.generate_qr_code(uri)

    async def verify_2fa(self, email: str, code: str) -> bool:
        async with self._session_factory() as session:
            async with session.begin():
                repo = UserRepositoryImpl(session)
                user = await repo.find_by_email(email)
                if not user:
                    raise UserNotFoundError
                if not user.is_two_factor_enabled:
                    raise HTTPException(status_code=400, detail="2FA not enabled.")
                secret = await self.totp_service.decrypt_secret(user.two_factor_secret, self.cipher_suite)
                valid = await self.totp_service.verify_code(secret, code)
                if not valid:
                    raise HTTPException(status_code=400, detail="Invalid 2FA code.")
                user.is_two_factor_verified = True
                await repo.update(user)
        return True

    async def update_user_profile(
            self, email: str, data: UserUpdateModel
    ) -> UserUpdateResponse:
        async with self._session_factory() as session:
            async with session.begin():
                repo = UserRepositoryImpl(session)

                user = await repo.find_by_email(email)
                if not user:
                    raise UserNotFoundError

                if user.is_two_factor_enabled:
                    if not data.two_fa_code:
                        raise FARequiredError
                    secret = await self.totp_service.decrypt_secret(
                        user.two_factor_secret, self.cipher_suite
                    )
                    if not await self.totp_service.verify_code(secret, data.two_fa_code):
                        raise Invalid2FACodeError

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
                        user.email  = Email(to_check['email'])

                if data.password:
                    user.password = Password(await self.hasher.bcrypt(data.password))

                await repo.update(user)

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

            user_email = payload.get("email") or payload.get("sub")
            if not user_email:
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

            await self.manager_token.invalidate_token(refresh_token, user_email)

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
        except Exception as e:
            raise HTTPException(
                status_code=401,
                detail="Token refresh failed"
            )

    async def logout(self, user_id: str, token: str) -> dict:
        try:
            success = await self.manager_token.invalidate_token(token, user_id)

            if success:
                return {
                    "message": "Déconnexion réussie",
                    "timestamp": _utc_iso_z(datetime.now(UTC)),
                    "user_id": user_id
                }
            else:
                raise HTTPException(
                    status_code=500,
                    detail="Erreur lors de l'invalidation du token"
                )

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail="Erreur lors de la déconnexion"
            )

    async def change_my_password(self, email: str, token: str, data: ChangeMyPasswordModel) -> ChangeMyPasswordResponse:
        user = await self.user_repository.find_by_email(email)
        if not user:
            raise UserNotFoundError

        if not await self.hasher.verify(data.current_password, user.password.password):
            raise InvalidPasswordError(email)

        if data.current_password == data.new_password:
            raise HTTPException(status_code=400, detail={"message": "Mot de passe invalide.", "code": "INVALID_PASSWORD"})

        if user.is_two_factor_enabled:
            if not data.two_fa_code:
                raise FARequiredError()
            if not user.two_factor_secret:
                raise HTTPException(status_code=500, detail="2FA secret missing for user")
            secret = await self.totp_service.decrypt_secret(user.two_factor_secret, self.cipher_suite)
            if not data.two_fa_code.isdigit():
                raise Invalid2FACodeError()
            if not await self.totp_service.verify_code(secret, data.two_fa_code):
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

        return ChangeMyPasswordResponse()

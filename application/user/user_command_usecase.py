from abc import ABC, abstractmethod

import shortuuid
from cryptography.fernet import Fernet
from fastapi import HTTPException

from application.user.user_command_model import UserCreateModel, UserLoginResponse, UserLoginModel, \
    InvalidPasswordError, UserDeleteResponse
from domain.services.authentication.hash import Hash
from domain.services.authentication.manager_token import ManagerToken
from domain.services.authentication.totp_service import TOTPService
from domain.user.exception.user_exception import UserNotFoundError, UserLoginNotFoundError, UserEmailAlreadyExistsError
from domain.user.model.email import Email
from domain.user.model.password import Password
from domain.user.model.user import User
from domain.user.repository.user_repository import UserRepository
from infrastructure.config import Settings


class UserCommandUseCase(ABC):

    @abstractmethod
    def create(self, user_create_model: UserCreateModel) -> UserLoginResponse:
        raise NotImplementedError

    @abstractmethod
    def login(self, user_login_model: UserLoginModel) -> UserLoginResponse:
        raise NotImplementedError

    @abstractmethod
    def delete_user(self, user_id: int) -> UserDeleteResponse:
        raise NotImplementedError

    @abstractmethod
    def enable_2fa(self, email: str) -> bytes:
        raise NotImplementedError

    @abstractmethod
    def verify_2fa(self, email: str, code: str) -> bool:
        raise NotImplementedError


class UserCommandUseCaseImpl(UserCommandUseCase):

    def __init__(
            self,
            user_repository: UserRepository,
            hasher: Hash,
            manager_token: ManagerToken,
            totp_service: TOTPService,
            settings: Settings
    ):
        self.user_repository: UserRepository = user_repository
        self.hasher = hasher
        self.manager_token = manager_token
        self.totp_service = totp_service
        self.settings = settings
        self.cipher_suite = Fernet(self.settings.encryption_key.encode())

    def create(self, data: UserCreateModel) -> UserLoginResponse:
        try:
            uuid = shortuuid.uuid()

            email = Email(data.email)
            user = User(
                email=email,
                pseudo=data.pseudo,
                uuid=uuid,
                password=Password(self.hasher.bcrypt(data.password))
            )

            existing_user = self.user_repository.find_by_email(data.email)
            if existing_user is not None:
                raise UserEmailAlreadyExistsError

            self.user_repository.create(user)
            self.user_repository.commit()

        except:
            self.user_repository.rollback()
            raise

        return UserLoginResponse(
            uuid=user.uuid,
            token_auth=self.manager_token.generate_token_login(user),
            token_expiration=self.manager_token.generate_expiration_token_login(user),
        )

    def login(self, user_login_model: UserLoginModel) -> UserLoginResponse:
        user = self.user_repository.find_by_email(user_login_model.email)
        if not user:
            raise UserLoginNotFoundError(user_login_model.email)
        if not self.hasher.verify(user.password.password, user_login_model.password):
            raise InvalidPasswordError(user_login_model.email)

        if user.is_two_factor_enabled:
            if not user_login_model.code:
                raise HTTPException(status_code=400, detail="2FA code required.")

            decrypted_secret = self.totp_service.decrypt_secret(user.two_factor_secret, self.cipher_suite)
            if not self.totp_service.verify_code(decrypted_secret, user_login_model.code):
                raise HTTPException(status_code=400, detail="Invalid 2FA code.")

        return UserLoginResponse(
            uuid=user.uuid,
            token_auth=self.manager_token.generate_token_login(user),
            token_expiration=self.manager_token.generate_expiration_token_login(user),
        )

    def delete_user(self, user_id: int) -> UserDeleteResponse:
        try:
            existing_user = self.user_repository.find_by_id(user_id)
            if existing_user is None:
                raise UserNotFoundError

            self.user_repository.delete_user(user_id)
            self.user_repository.commit()
        except:
            self.user_repository.rollback()
            raise

        return UserDeleteResponse()

    def enable_2fa(self, email: str) -> bytes:
        user = self.user_repository.find_by_email(email)
        if not user:
            raise UserNotFoundError

        if user.is_two_factor_enabled:
            raise HTTPException(status_code=400, detail="2FA is already enabled.")

        secret = self.totp_service.generate_secret()
        encrypted_secret = self.totp_service.encrypt_secret(secret, self.cipher_suite)
        user.two_factor_secret = encrypted_secret
        user.is_two_factor_enabled = True
        self.user_repository.update(user)
        self.user_repository.commit()

        totp_uri = self.totp_service.get_totp_uri(secret, user.email.value, "BetLeague")
        qr_code = self.totp_service.generate_qr_code(totp_uri)
        return qr_code

    def verify_2fa(self, email: str, code: str) -> bool:
        user = self.user_repository.find_by_email(email)
        if not user:
            raise UserNotFoundError

        if not user.is_two_factor_enabled:
            raise HTTPException(status_code=400, detail="2FA is not enabled.")

        decrypted_secret = self.totp_service.decrypt_secret(user.two_factor_secret, self.cipher_suite)
        is_valid = self.totp_service.verify_code(decrypted_secret, code)

        if is_valid:
            user.is_two_factor_verified = True
            self.user_repository.update(user)
            self.user_repository.commit()
            return True
        else:
            raise HTTPException(status_code=400, detail="Invalid 2FA code.")

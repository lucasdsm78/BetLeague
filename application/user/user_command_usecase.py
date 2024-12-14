from abc import ABC, abstractmethod

import shortuuid

from application.user.user_command_model import UserCreateModel, UserLoginResponse, UserLoginModel, \
    InvalidPasswordError, UserDeleteResponse
from domain.services.authentication.hash import Hash
from domain.services.authentication.manager_token import ManagerToken
from domain.user.exception.user_exception import UserNotFoundError, UserLoginNotFoundError, UserEmailAlreadyExistsError
from domain.user.model.email import Email
from domain.user.model.password import Password
from domain.user.model.user import User
from domain.user.repository.user_repository import UserRepository


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


class UserCommandUseCaseImpl(UserCommandUseCase):

    def __init__(
            self,
            user_repository: UserRepository,
            hasher: Hash,
            manager_token: ManagerToken
    ):
        self.user_repository: UserRepository = user_repository
        self.hasher = hasher
        self.manager_token = manager_token

    def create(self, data: UserCreateModel) -> UserLoginResponse:
        try:
            uuid = shortuuid.uuid()

            email = Email(data.email)
            user = User(
                email=email,
                pseudo=data.pseudo,
                uuid=uuid,
                first_name=data.first_name,
                last_name=data.last_name,
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

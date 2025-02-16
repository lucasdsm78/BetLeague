from abc import ABC, abstractmethod
from typing import Optional, List, Dict

from pydantic import BaseModel

from application.user.user_query_model import UserReadModel
from domain.user.exception.user_exception import UserNotFoundError
from domain.user.repository.user_repository import UserRepository


class UserQueryUseCase(ABC):

    @abstractmethod
    def fetch_users(self) -> dict:
        raise NotImplementedError

    @abstractmethod
    def fetch_user_by_id(self, user_id: int) -> Optional[UserReadModel]:
        raise NotImplementedError

    @abstractmethod
    def get_all_rank_users(self) -> List[Dict[str, any]]:
        raise NotImplementedError


class UserQueryUseCaseImpl(UserQueryUseCase, BaseModel):
    user_repository: UserRepository

    class Config:
        arbitrary_types_allowed = True

    def fetch_users(self) -> dict:
        try:
            users = self.user_repository.find_users()
            return dict(
                users=list(map(lambda user: UserReadModel.from_entity(
                    user=user), users))
            )

        except Exception as e:
            raise

    def fetch_user_by_id(self, user_id: int) -> Optional[UserReadModel]:
        try:
            user = self.user_repository.find_by_id(user_id)
            if user is None:
                raise UserNotFoundError
        except:
            raise

        return UserReadModel.from_entity(user)

    def get_all_rank_users(self) -> List[Dict[str, any]]:
        try:
            return self.user_repository.get_all_rank_users()

        except Exception as e:
            raise


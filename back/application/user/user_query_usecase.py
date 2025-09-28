from abc import ABC, abstractmethod
from typing import Optional, List, Dict

from pydantic import BaseModel

from application.user.user_query_model import UserReadModel
from domain.user.exception.user_exception import UserNotFoundError, UserNotOwnerError
from domain.user.repository.user_repository import UserRepository


class UserQueryUseCase(ABC):

    @abstractmethod
    async def fetch_users(self) -> dict:
        raise NotImplementedError

    @abstractmethod
    async def fetch_user_by_id(self, user_id: int, email: str) -> Optional[UserReadModel]:
        raise NotImplementedError

    @abstractmethod
    async def get_all_rank_users(self) -> List[Dict[str, any]]:
        raise NotImplementedError


class UserQueryUseCaseImpl(UserQueryUseCase, BaseModel):
    user_repository: UserRepository

    class Config:
        arbitrary_types_allowed = True

    async def fetch_users(self) -> dict:
        try:
            users = await self.user_repository.find_users()
            return dict(
                users=list(map(lambda user: UserReadModel.from_entity(
                    user=user), users))
            )

        except Exception as e:
            raise

    async def fetch_user_by_id(self, user_id: int, email: str) -> Optional[UserReadModel]:
        try:
            user_connected = await self.user_repository.find_by_email(email)
            user = await self.user_repository.find_by_id(user_id)
            if user_connected.id != user.id:
                raise UserNotOwnerError
        except:
            raise

        return UserReadModel.from_entity(user)

    async def get_all_rank_users(self) -> List[Dict[str, any]]:
        try:
            return await self.user_repository.get_all_rank_users()

        except Exception as e:
            raise


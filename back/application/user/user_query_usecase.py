from abc import ABC, abstractmethod
from typing import Optional, List, Dict

from pydantic import BaseModel

from application.user.user_query_model import UserReadModel, UserSearchQuery, UserSearchResponse, UserSearchResultModel
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

    @abstractmethod
    async def search_users(self, search_query: UserSearchQuery) -> UserSearchResponse:
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

    async def search_users(self, search_query: UserSearchQuery) -> UserSearchResponse:
        try:
            search_query.validate_query()

            all_users_response = await self.fetch_users()
            all_users = all_users_response.get('users', [])

            if not all_users:
                return UserSearchResponse(
                    users=[],
                    total=0,
                    query=search_query.query.strip()
                )

            query_lower = search_query.query.strip().lower()
            filtered_users = []

            for user_read_model in all_users:
                pseudo = (user_read_model.pseudo or '').lower()
                email = (user_read_model.email or '').lower()

                if query_lower in pseudo or query_lower in email:
                    search_result = UserSearchResultModel.from_user_read_model(user_read_model)
                    filtered_users.append(search_result)

            limited_results = filtered_users[:search_query.limit]

            return UserSearchResponse(
                users=limited_results,
                total=len(limited_results),
                query=search_query.query.strip()
            )

        except ValueError as ve:
            raise ve
        except Exception as e:
            print(f"User search error in use case: {e}")
            raise


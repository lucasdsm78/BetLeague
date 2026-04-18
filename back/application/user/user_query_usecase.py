from abc import ABC, abstractmethod
from typing import Optional, List, Dict

from pydantic import BaseModel

from application.user.user_query_model import (
    CommerceAvailabilityReadModel,
    UserReadModel,
    UserSearchQuery,
    UserSearchResponse,
    UserSearchResultModel,
    TournamentCreationAccessReadModel,
)
from domain.tournament.repository.tournament_repository import TournamentRepository
from domain.shop.service.shop_availability_policy import ShopAvailabilityPolicy
from domain.tournament.service.tournament_creation_policy import TournamentCreationPolicy, current_month_window_ms
from domain.tournament_subscription.repository.tournament_subscription_repository import TournamentSubscriptionRepository
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
    tournament_repository: TournamentRepository
    tournament_subscription_repository: TournamentSubscriptionRepository
    shop_availability_policy: ShopAvailabilityPolicy = ShopAvailabilityPolicy()
    tournament_creation_policy: TournamentCreationPolicy = TournamentCreationPolicy()

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

        month_start_ms, next_month_start_ms = current_month_window_ms()
        monthly_used = await self.tournament_repository.count_created_by_user_between(
            user.id,
            month_start_ms,
            next_month_start_ms,
        )
        subscription = await self.tournament_subscription_repository.find_active_by_user_id(user.id)
        has_active_subscription = bool(subscription and subscription.is_active())
        access = self.tournament_creation_policy.evaluate(
            has_active_subscription=has_active_subscription,
            monthly_free_tournaments_used=monthly_used,
        )
        commerce_status = self.shop_availability_policy.get_status()

        return UserReadModel.from_entity(
            user,
            tournament_creation_access=TournamentCreationAccessReadModel(**access.__dict__),
            is_tournament_subscriber=has_active_subscription,
            commerce_availability=CommerceAvailabilityReadModel(**commerce_status.__dict__),
        )

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

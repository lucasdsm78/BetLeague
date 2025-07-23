from abc import ABC, abstractmethod
from typing import Optional

from domain.tournament_subscription.model.tournament_subscription import TournamentSubscription


class TournamentSubscriptionRepository(ABC):
    @abstractmethod
    async def create(self, subscription: TournamentSubscription) -> None:
        raise NotImplementedError

    @abstractmethod
    async def update(self, subscription: TournamentSubscription) -> None:
        raise NotImplementedError

    @abstractmethod
    async def find_by_id(self, subscription_id: int) -> Optional[TournamentSubscription]:
        raise NotImplementedError

    @abstractmethod
    async def find_active_by_user_id(self, user_id: int) -> Optional[TournamentSubscription]:
        raise NotImplementedError

    @abstractmethod
    async def find_by_stripe_subscription_id(self, stripe_subscription_id: str) -> Optional[TournamentSubscription]:
        raise NotImplementedError

    @abstractmethod
    async def commit(self) -> None:
        raise NotImplementedError

    @abstractmethod
    async def rollback(self) -> None:
        raise NotImplementedError

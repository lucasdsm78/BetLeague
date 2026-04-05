from __future__ import annotations

from abc import ABC, abstractmethod

from domain.tournament_subscription.repository.tournament_subscription_repository import TournamentSubscriptionRepository
from domain.user.repository.user_repository import UserRepository


class TournamentSubscriptionUnitOfWork(ABC):
    user_repo: UserRepository
    tournament_subscription_repo: TournamentSubscriptionRepository

    @abstractmethod
    async def __aenter__(self) -> "TournamentSubscriptionUnitOfWork":
        raise NotImplementedError

    @abstractmethod
    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        raise NotImplementedError

    @abstractmethod
    async def commit(self) -> None:
        raise NotImplementedError


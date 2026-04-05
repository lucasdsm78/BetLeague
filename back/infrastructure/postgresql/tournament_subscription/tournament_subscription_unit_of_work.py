from __future__ import annotations

from typing import Callable

from sqlalchemy.ext.asyncio import AsyncSession

from domain.tournament_subscription.unit_of_work import TournamentSubscriptionUnitOfWork
from infrastructure.postgresql.tournament_subscription.tournament_subscription_repository import TournamentSubscriptionRepositoryImpl
from infrastructure.postgresql.user.user_repository import UserRepositoryImpl


class TournamentSubscriptionUnitOfWorkImpl(TournamentSubscriptionUnitOfWork):

    def __init__(self, session_factory: Callable[[], AsyncSession]):
        self._session_factory = session_factory
        self._session: AsyncSession | None = None

    async def __aenter__(self) -> "TournamentSubscriptionUnitOfWorkImpl":
        self._session = self._session_factory()
        await self._session.begin()
        self.user_repo = UserRepositoryImpl(self._session)
        self.tournament_subscription_repo = TournamentSubscriptionRepositoryImpl(self._session)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        if exc_type is not None and self._session is not None:
            await self._session.rollback()
        if self._session is not None:
            await self._session.close()
        self._session = None

    async def commit(self) -> None:
        if self._session is None:
            raise RuntimeError("TournamentSubscriptionUnitOfWork not initialized")
        await self._session.commit()


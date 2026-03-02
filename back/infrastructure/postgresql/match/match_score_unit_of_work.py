from __future__ import annotations

from typing import Callable

from sqlalchemy.ext.asyncio import AsyncSession

from application.events.outbox_event_bus import OutboxDomainEventBus
from domain.match.unit_of_work import MatchScoreUnitOfWork
from infrastructure.postgresql.match.match_odd_repository import MatchOddRepositoryImpl
from infrastructure.postgresql.match.match_repository import MatchRepositoryImpl


class MatchScoreUnitOfWorkImpl(MatchScoreUnitOfWork):

    def __init__(self, session_factory: Callable[[], AsyncSession]):
        self._session_factory = session_factory
        self._session: AsyncSession | None = None

    async def __aenter__(self) -> MatchScoreUnitOfWorkImpl:
        self._session = self._session_factory()
        await self._session.begin()
        self.match_repo = MatchRepositoryImpl(self._session)
        self.match_odd_repo = MatchOddRepositoryImpl(self._session)
        self.outbox_bus = OutboxDomainEventBus(self._session)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        if exc_type is not None:
            await self._session.rollback()
        await self._session.close()
        self._session = None

    async def commit(self) -> None:
        await self._session.commit()

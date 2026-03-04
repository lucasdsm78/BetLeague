from __future__ import annotations

from abc import ABC, abstractmethod

from application.events.event_bus import DomainEventBus
from domain.match.repository.match_odd_repository import MatchOddRepository
from domain.match.repository.match_repository import MatchRepository


class MatchScoreUnitOfWork(ABC):
    match_repo: MatchRepository
    match_odd_repo: MatchOddRepository
    outbox_bus: DomainEventBus

    @abstractmethod
    async def __aenter__(self) -> MatchScoreUnitOfWork:
        raise NotImplementedError

    @abstractmethod
    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        raise NotImplementedError

    @abstractmethod
    async def commit(self) -> None:
        raise NotImplementedError

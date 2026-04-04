from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import UTC, datetime
import logging
from typing import Callable

from sqlalchemy.ext.asyncio import AsyncSession

from application.tournament.process_due_tournament_usecase import (
    ProcessDueTournamentUseCase,
    ProcessDueTournamentUseCaseImpl,
)
from infrastructure.postgresql.tournament.tournament_repository import TournamentRepositoryImpl


logger = logging.getLogger(__name__)


class ProcessTournamentSchedulerUseCase(ABC):

    @abstractmethod
    async def get_due_tournament_ids(self, as_of: datetime | None = None) -> list[int]:
        raise NotImplementedError

    @abstractmethod
    async def process_tournaments(self, as_of: datetime | None = None) -> None:
        raise NotImplementedError


class ProcessTournamentSchedulerUseCaseImpl(ProcessTournamentSchedulerUseCase):
    def __init__(
        self,
        session_factory: Callable[[], AsyncSession],
        process_due_tournament_usecase: ProcessDueTournamentUseCase | None = None,
    ):
        self._session_factory = session_factory
        self._process_due_tournament_usecase = process_due_tournament_usecase or ProcessDueTournamentUseCaseImpl(
            session_factory=session_factory,
        )

    @staticmethod
    def _normalize_as_of(as_of: datetime | None) -> datetime:
        if as_of is None:
            return datetime.now(UTC)
        if as_of.tzinfo is None:
            return as_of.replace(tzinfo=UTC)
        return as_of.astimezone(UTC)

    async def get_due_tournament_ids(self, as_of: datetime | None = None) -> list[int]:
        normalized_as_of = self._normalize_as_of(as_of)
        async with self._session_factory() as session:
            tournament_repository = TournamentRepositoryImpl(session)
            tournament_ids = await tournament_repository.find_due_tournament_ids(normalized_as_of)
            logger.info(
                "tournament_scheduler.due_ids_loaded",
                extra={
                    "event": "tournament_scheduler.due_ids_loaded",
                    "as_of": normalized_as_of.isoformat(),
                    "due_tournament_ids": tournament_ids,
                    "due_count": len(tournament_ids),
                },
            )
            return tournament_ids

    async def process_tournaments(self, as_of: datetime | None = None) -> None:
        normalized_as_of = self._normalize_as_of(as_of)
        tournament_ids = await self.get_due_tournament_ids(normalized_as_of)

        logger.info(
            "tournament_scheduler.batch_started",
            extra={
                "event": "tournament_scheduler.batch_started",
                "as_of": normalized_as_of.isoformat(),
                "tournament_count": len(tournament_ids),
            },
        )
        for tournament_id in tournament_ids:
            await self._process_due_tournament_usecase.process_tournament(
                tournament_id=tournament_id,
                as_of=normalized_as_of,
            )
        logger.info(
            "tournament_scheduler.batch_finished",
            extra={
                "event": "tournament_scheduler.batch_finished",
                "as_of": normalized_as_of.isoformat(),
                "tournament_count": len(tournament_ids),
            },
        )


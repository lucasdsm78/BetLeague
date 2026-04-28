from datetime import datetime, UTC
import logging
from typing import Callable

from sqlalchemy.ext.asyncio import AsyncSession

from application.tournament.process_tournament_scheduler_usecase import (
    ProcessTournamentSchedulerUseCase,
    ProcessTournamentSchedulerUseCaseImpl,
)
from domain.scheduler.tournament_scheduler import TournamentScheduler


logger = logging.getLogger(__name__)


class TournamentSchedulerImpl(TournamentScheduler):

    def __init__(
        self,
        session_factory: Callable[[], AsyncSession],
        usecase: ProcessTournamentSchedulerUseCase | None = None,
    ):
        self._session_factory = session_factory
        self._usecase = usecase or ProcessTournamentSchedulerUseCaseImpl(session_factory=session_factory)

    @staticmethod
    def _normalize_as_of(as_of: datetime | None) -> datetime:
        if as_of is None:
            return datetime.now(UTC)
        if as_of.tzinfo is None:
            return as_of.replace(tzinfo=UTC)
        return as_of.astimezone(UTC)

    async def process_tournaments(self, as_of: datetime | None = None):
        normalized_as_of = self._normalize_as_of(as_of)
        logger.info(
            "tournament_scheduler.dispatching_usecase",
            extra={
                "event": "tournament_scheduler.dispatching_usecase",
                "as_of": normalized_as_of.isoformat(),
            },
        )
        await self._usecase.process_tournaments(as_of=normalized_as_of)

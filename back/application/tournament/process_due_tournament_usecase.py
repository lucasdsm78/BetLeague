from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import UTC, datetime
import logging
from typing import Callable

from sqlalchemy.ext.asyncio import AsyncSession

from application.tournament.advance_tournament_stage_usecase import (
    AdvanceTournamentStageUseCase,
    AdvanceTournamentStageUseCaseImpl,
)
from infrastructure.postgresql.tournament.tournament_match_repository import TournamentMatchRepositoryImpl
from infrastructure.postgresql.tournament.tournament_players_repository import TournamentPlayersRepositoryImpl
from infrastructure.postgresql.tournament.tournament_repository import TournamentRepositoryImpl
from infrastructure.postgresql.tournament.tournament_stage_repository import TournamentStageRepositoryImpl
from infrastructure.postgresql.user.user_repository import UserRepositoryImpl


logger = logging.getLogger(__name__)


class ProcessDueTournamentUseCase(ABC):

    @abstractmethod
    async def process_tournament(self, tournament_id: int, as_of: datetime | None = None) -> None:
        raise NotImplementedError


class ProcessDueTournamentUseCaseImpl(ProcessDueTournamentUseCase):
    def __init__(
        self,
        session_factory: Callable[[], AsyncSession],
        advance_tournament_stage_usecase: AdvanceTournamentStageUseCase | None = None,
    ):
        self._session_factory = session_factory
        self._advance_tournament_stage_usecase = advance_tournament_stage_usecase or AdvanceTournamentStageUseCaseImpl()

    @staticmethod
    def _normalize_as_of(as_of: datetime | None) -> datetime:
        if as_of is None:
            return datetime.now(UTC)
        if as_of.tzinfo is None:
            return as_of.replace(tzinfo=UTC)
        return as_of.astimezone(UTC)

    async def process_tournament(self, tournament_id: int, as_of: datetime | None = None) -> None:
        normalized_as_of = self._normalize_as_of(as_of)

        try:
            async with self._session_factory() as session:
                async with session.begin():
                    tournament_repository = TournamentRepositoryImpl(session)
                    tournament_stage_repository = TournamentStageRepositoryImpl(session)
                    tournament_match_repository = TournamentMatchRepositoryImpl(session)
                    tournament_players_repository = TournamentPlayersRepositoryImpl(session)
                    user_repository = UserRepositoryImpl(session)

                    tournament = await tournament_repository.find_by_id_for_update(tournament_id)
                    if tournament is None:
                        logger.info(
                            "tournament_scheduler.skipped",
                            extra={
                                "event": "tournament_scheduler.skipped",
                                "tournament_id": tournament_id,
                                "reason": "not_found_or_locked",
                                "as_of": normalized_as_of.isoformat(),
                            },
                        )
                        return

                    active_stage = await tournament_stage_repository.find_due_active_stage_for_update(
                        tournament_id=tournament_id,
                        as_of=normalized_as_of,
                    )
                    if active_stage is None:
                        logger.info(
                            "tournament_scheduler.skipped",
                            extra={
                                "event": "tournament_scheduler.skipped",
                                "tournament_id": tournament_id,
                                "reason": "no_due_active_stage",
                                "as_of": normalized_as_of.isoformat(),
                            },
                        )
                        return

                    stage_matches = await tournament_match_repository.find_matches_by_stage_id(active_stage.id)
                    stage_players = await tournament_players_repository.find_qualified_players_by_stage(
                        tournament_id=tournament_id,
                        stage=active_stage.type,
                    )
                    next_stage = await tournament_stage_repository.find_next_stage(
                        tournament_id=tournament_id,
                        current_stage=active_stage,
                    )

                    await self._advance_tournament_stage_usecase.execute(
                        tournament=tournament,
                        active_stage=active_stage,
                        next_stage=next_stage,
                        stage_matches=stage_matches,
                        stage_players=stage_players,
                        tournament_repository=tournament_repository,
                        tournament_stage_repository=tournament_stage_repository,
                        tournament_match_repository=tournament_match_repository,
                        tournament_players_repository=tournament_players_repository,
                        user_repository=user_repository,
                    )

                    logger.info(
                        "tournament_scheduler.processed",
                        extra={
                            "event": "tournament_scheduler.processed",
                            "tournament_id": tournament_id,
                            "stage_id": active_stage.id,
                            "stage_type": active_stage.type.value,
                            "as_of": normalized_as_of.isoformat(),
                        },
                    )
        except Exception:
            logger.exception(
                "tournament_scheduler.failed",
                extra={
                    "event": "tournament_scheduler.failed",
                    "tournament_id": tournament_id,
                    "as_of": normalized_as_of.isoformat(),
                },
            )
            raise


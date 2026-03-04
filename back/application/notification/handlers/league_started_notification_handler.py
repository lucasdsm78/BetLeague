from __future__ import annotations

import logging
from typing import Callable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from application.notification.notification_command_usecase import NotificationCommandUseCase
from domain.league.events.league_started import LeagueStarted
from domain.notification.model.notification import NotificationType
from infrastructure.postgresql.league.db_league_players import DBLeaguePlayers
from infrastructure.postgresql.league.league_repository import LeagueRepositoryImpl

logger = logging.getLogger(__name__)


class OnLeagueStartedCreateNotification:

    def __init__(self, notification_uc: NotificationCommandUseCase, *, session_factory: Callable[[], AsyncSession]):
        self._notification_uc = notification_uc
        self._session_factory = session_factory

    async def __call__(self, event: LeagueStarted) -> None:
        try:
            async with self._session_factory() as session:
                league_repo = LeagueRepositoryImpl(session)
                league = await league_repo.find_by_id(int(event.league_id))
                if not league:
                    return

                res = await session.execute(
                    select(DBLeaguePlayers.user_id).where(DBLeaguePlayers.league_id == int(event.league_id))
                )
                user_ids = [int(r[0]) for r in (res.all() or [])]

            for uid in user_ids:
                await self._notification_uc.create(
                    user_id=uid,
                    type=NotificationType.LEAGUE_STARTED,
                    title="Ligue démarrée",
                    message=f"La ligue {league.name} a commencé. Bonne chance !",
                    data={"league_id": int(event.league_id)},
                )
        except Exception:
            logger.exception("[OnLeagueStartedCreateNotification] Erreur notification")
            raise

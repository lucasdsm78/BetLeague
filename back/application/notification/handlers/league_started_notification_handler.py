from __future__ import annotations

import logging
from typing import Callable

from sqlalchemy.ext.asyncio import AsyncSession

from application.notification.notification_command_usecase import NotificationCommandUseCase, NotificationCreateCommand
from domain.league.events.league_started import LeagueStarted
from domain.notification.model.notification import NotificationType
from infrastructure.postgresql.league.league_players_repository import LeaguePlayersRepositoryImpl
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
                players_repo = LeaguePlayersRepositoryImpl(session)
                league = await league_repo.find_by_id(int(event.league_id))
                if not league:
                    return
                user_ids = await players_repo.list_user_ids_by_league_id(int(event.league_id))

            target_user_ids = [uid for uid in user_ids if int(uid) != int(event.started_by_user_id)]
            if not target_user_ids:
                return

            await self._notification_uc.create_many(
                items=[
                    NotificationCreateCommand(
                        user_id=int(uid),
                        type=NotificationType.LEAGUE_STARTED,
                        title="Ligue démarrée",
                        message=f"La ligue {league.name} a commencé. Bonne chance !",
                        data={"league_id": int(event.league_id)},
                        dedupe_key=f"league_started:{int(event.league_id)}",
                    )
                    for uid in target_user_ids
                ]
            )
        except Exception:
            logger.exception("[OnLeagueStartedCreateNotification] Erreur notification")
            raise

from __future__ import annotations

import logging
from typing import Callable

from sqlalchemy.ext.asyncio import AsyncSession

from application.notification.notification_command_usecase import NotificationCommandUseCase
from domain.league.events.league_ended import LeagueEnded
from domain.notification.model.notification import NotificationType
from infrastructure.postgresql.league.league_players_repository import LeaguePlayersRepositoryImpl

logger = logging.getLogger(__name__)


class OnLeagueEndedCreateNotification:
    def __init__(
        self,
        notification_uc: NotificationCommandUseCase,
        session_factory: Callable[[], AsyncSession],
    ):
        self._notification_uc = notification_uc
        self._session_factory = session_factory

    async def __call__(self, event: LeagueEnded) -> None:
        try:
            async with self._session_factory() as session:
                league_players_repo = LeaguePlayersRepositoryImpl(session)
                user_ids = await league_players_repo.list_user_ids_by_league_id(event.league_id)

            for user_id in user_ids:
                await self._notification_uc.create(
                    user_id=user_id,
                    type=NotificationType.LEAGUE_ENDED,
                    title="Ligue terminée",
                    message=(
                        f"La ligue {event.league_name} est terminée. "
                        f"Vainqueur: {event.winner_pseudo}. Récompense: {event.rewarded_amount:g} BTL."
                    ),
                    data={
                        "league_id": event.league_id,
                        "winner_id": event.winner_id,
                        "winner_pseudo": event.winner_pseudo,
                        "rewarded_amount": event.rewarded_amount,
                    },
                    dedupe_key=f"league_ended:{event.league_id}",
                )
        except Exception:
            logger.exception("[OnLeagueEndedCreateNotification] Erreur notification")
            raise


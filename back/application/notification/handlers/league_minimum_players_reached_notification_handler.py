from __future__ import annotations

import logging

from application.notification.notification_command_usecase import NotificationCommandUseCase
from domain.league.events.league_minimum_players_reached import LeagueMinimumPlayersReached
from domain.notification.model.notification import NotificationType

logger = logging.getLogger(__name__)


class OnLeagueMinimumPlayersReachedCreateNotification:

    def __init__(self, notification_uc: NotificationCommandUseCase):
        self._notification_uc = notification_uc

    async def __call__(self, event: LeagueMinimumPlayersReached) -> None:
        try:
            await self._notification_uc.create(
                user_id=event.owner_user_id,
                type=NotificationType.LEAGUE_MINIMUM_PLAYERS_REACHED,
                title="Seuil minimum atteint",
                message=(
                    f"La ligue {event.league_name} a atteint son minimum de {event.min_players} joueurs. "
                    f"Vous pouvez maintenant la démarrer."
                ),
                data={
                    "league_id": int(event.league_id),
                    "min_players": int(event.min_players),
                    "current_players_count": int(event.current_players_count),
                },
                dedupe_key=f"league_minimum_players_reached:{int(event.league_id)}:{int(event.min_players)}",
            )
        except Exception:
            logger.exception("[OnLeagueMinimumPlayersReachedCreateNotification] Erreur notification")
            raise


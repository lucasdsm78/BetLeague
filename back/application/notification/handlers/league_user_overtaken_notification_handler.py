from __future__ import annotations

import logging

from application.notification.notification_command_usecase import NotificationCommandUseCase
from domain.league.events.league_user_overtaken import LeagueUserOvertaken
from domain.notification.model.notification import NotificationType

logger = logging.getLogger(__name__)


class OnLeagueUserOvertakenCreateNotification:
    def __init__(self, notification_uc: NotificationCommandUseCase):
        self._notification_uc = notification_uc

    async def __call__(self, event: LeagueUserOvertaken) -> None:
        try:
            await self._notification_uc.create(
                user_id=event.overtaken_user_id,
                type=NotificationType.LEAGUE_OVERTAKEN,
                title="Classement mis à jour",
                message=(
                    f"{event.overtaken_by_pseudo} est passé devant toi dans la ligue {event.league_name}."
                ),
                data={
                    "league_id": event.league_id,
                    "overtaken_by_user_id": event.overtaken_by_user_id,
                    "previous_position": event.previous_position,
                    "new_position": event.new_position,
                },
                dedupe_key=(
                    f"league_overtaken:{event.league_id}:{event.overtaken_by_user_id}:"
                    f"{event.previous_position}:{event.new_position}"
                ),
            )
        except Exception:
            logger.exception("[OnLeagueUserOvertakenCreateNotification] Erreur notification")
            raise




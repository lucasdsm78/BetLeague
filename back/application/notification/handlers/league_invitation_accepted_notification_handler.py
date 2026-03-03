from __future__ import annotations

import logging

from application.notification.notification_command_usecase import NotificationCommandUseCase
from domain.league.events.league_invitation_accepted import LeagueInvitationAccepted
from domain.notification.model.notification import NotificationType

logger = logging.getLogger(__name__)


class OnLeagueInvitationAcceptedCreateNotification:

    def __init__(self, notification_uc: NotificationCommandUseCase):
        self._notification_uc = notification_uc

    async def __call__(self, event: LeagueInvitationAccepted) -> None:
        try:
            await self._notification_uc.create(
                user_id=event.sender_user_id,
                type=NotificationType.LEAGUE_INVITATION_ACCEPTED,
                title="Invitation acceptée",
                message=f"{event.invited_user_pseudo} a accepté ton invitation à la ligue {event.league_name}.",
                data={
                    "league_id": event.league_id,
                    "invited_user_id": event.invited_user_id,
                },
            )
        except Exception:
            logger.exception("[OnLeagueInvitationAccepted] Erreur notification")
            raise

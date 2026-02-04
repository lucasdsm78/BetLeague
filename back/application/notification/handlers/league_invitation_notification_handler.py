from __future__ import annotations

from domain.league.events.league_invitation_created import LeagueInvitationCreated
from domain.notification.model.notification import NotificationType
from application.notification.notification_command_usecase import NotificationCommandUseCase


class OnLeagueInvitationCreatedCreateNotification:

    def __init__(self, notification_uc: NotificationCommandUseCase):
        self._notification_uc = notification_uc

    async def __call__(self, event: LeagueInvitationCreated) -> None:
        try:
            await self._notification_uc.create(
                user_id=event.invited_user_id,
                type=NotificationType.LEAGUE_INVITATION,
                title="Nouvelle invitation",
                message=f"{event.sender_pseudo} t'a invité à rejoindre la ligue {event.league_name}.",
                data={
                    "league_id": event.league_id,
                    "invitation_user_sender_id": event.sender_user_id,
                },
            )
        except Exception:
            pass


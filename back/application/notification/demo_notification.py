from __future__ import annotations

from application.notification.notification_command_usecase import NotificationCommandUseCase
from domain.notification.model.notification import NotificationType


async def notify_league_invitation_accepted(
    *,
    notification_uc: NotificationCommandUseCase,
    receiver_user_id: int,
    sender_user_id: int,
    league_id: int,
) -> None:
    """Helper application-level: exemple d’appel depuis un usecase existant.

    But: illustrer comment on peut appeler le système de notifications "à n'importe quel moment".
    """

    await notification_uc.create(
        user_id=receiver_user_id,
        type=NotificationType.LEAGUE_INVITATION_ACCEPTED,
        title="Invitation acceptée",
        message="Un joueur a accepté ton invitation de ligue.",
        data={"league_id": league_id, "sender_user_id": sender_user_id},
    )


from __future__ import annotations

import logging

from application.notification.notification_command_usecase import NotificationCommandUseCase
from domain.notification.model.notification import NotificationType
from domain.ticket.event.ticket_resolved_event import TicketResolvedEvent

logger = logging.getLogger(__name__)


class OnTicketResolvedCreateNotification:
    def __init__(self, notification_uc: NotificationCommandUseCase):
        self._notification_uc = notification_uc

    async def __call__(self, event: TicketResolvedEvent) -> None:
        try:
            is_win = bool(event.is_win)
            notification_type = NotificationType.BET_WON if is_win else NotificationType.BET_LOST
            title = "Ticket gagné" if is_win else "Ticket perdu"
            message = (
                f"Ton ticket #{event.ticket_id} est gagné. Gain: {event.gain:g} BTL."
                if is_win
                else f"Ton ticket #{event.ticket_id} est perdu."
            )
            await self._notification_uc.create(
                user_id=event.user_id,
                type=notification_type,
                title=title,
                message=message,
                data={
                    "ticket_id": event.ticket_id,
                    "league_id": event.league_id,
                    "is_win": is_win,
                    "gain": event.gain,
                },
                dedupe_key=f"ticket_resolved:{event.ticket_id}:{'win' if is_win else 'lose'}",
            )
        except Exception:
            logger.exception("[OnTicketResolvedCreateNotification] Erreur notification")
            raise


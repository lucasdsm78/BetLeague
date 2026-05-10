from __future__ import annotations

import logging
from typing import Callable

from sqlalchemy.ext.asyncio import AsyncSession

from application.notification.notification_command_usecase import NotificationCommandUseCase
from domain.notification.model.notification import NotificationType
from domain.ticket.event.ticket_choices_resolved_event import TicketChoicesResolvedEvent
from domain.ticket.model.match_choice_status import MatchChoiceStatus
from infrastructure.postgresql.match.match_repository import MatchRepositoryImpl
from infrastructure.postgresql.ticket.match_choices_repository import MatchChoicesRepositoryImpl
from infrastructure.postgresql.ticket.ticket_repository import TicketRepositoryImpl

logger = logging.getLogger(__name__)


class OnTicketChoicesResolvedCreateNotification:
    def __init__(
        self,
        notification_uc: NotificationCommandUseCase,
        session_factory: Callable[[], AsyncSession],
    ):
        self._notification_uc = notification_uc
        self._session_factory = session_factory

    async def __call__(self, event: TicketChoicesResolvedEvent) -> None:
        try:
            async with self._session_factory() as session:
                ticket_repo = TicketRepositoryImpl(session)
                match_repo = MatchRepositoryImpl(session)
                mc_repo = MatchChoicesRepositoryImpl(session)

                ticket = await ticket_repo.find_by_id(event.ticket_id)
                match = await match_repo.find_by_id(event.match_id)
                if not ticket or not match:
                    return

                choice = next(
                    (item for item in await mc_repo.find_all_by_ticket_id(ticket.id) if item.match_id == event.match_id),
                    None,
                )
                if choice is None or choice.status == MatchChoiceStatus.pending:
                    return

                is_win = choice.status == MatchChoiceStatus.correct
                result_label = "gagné" if is_win else "perdu"
                dedupe_key = f"match_result:{ticket.id}:{event.match_id}:{choice.status.value}"
                await self._notification_uc.create(
                    user_id=ticket.user.id,
                    type=NotificationType.MATCH_RESULT,
                    title=f"Match {result_label}",
                    message=(
                        f"{match.home_team} - {match.away_team} : ton pronostic du ticket #{ticket.id} est {result_label}."
                    ),
                    data={
                        "ticket_id": ticket.id,
                        "match_id": match.id,
                        "league_id": ticket.league_id,
                        "result": choice.status.value,
                    },
                    dedupe_key=dedupe_key,
                )
        except Exception:
            logger.exception("[OnTicketChoicesResolvedCreateNotification] Erreur notification")
            raise


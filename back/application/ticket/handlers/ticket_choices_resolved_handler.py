from __future__ import annotations

import logging
from typing import Callable

from sqlalchemy.ext.asyncio import AsyncSession

from domain.ticket.event.ticket_choices_resolved_event import TicketChoicesResolvedEvent
from domain.ticket.model.ticket_status import TicketStatus
from infrastructure.postgresql.ticket.match_choices_repository import MatchChoicesRepositoryImpl
from infrastructure.postgresql.ticket.ticket_repository import TicketRepositoryImpl

logger = logging.getLogger(__name__)


class OnTicketChoicesResolvedCheckStatus:

    def __init__(self, session_factory: Callable[[], AsyncSession]):
        self._session_factory = session_factory

    async def __call__(self, event: TicketChoicesResolvedEvent) -> None:
        try:
            async with self._session_factory() as session:
                async with session.begin():
                    ticket_repo = TicketRepositoryImpl(session)
                    mc_repo = MatchChoicesRepositoryImpl(session)

                    ticket = await ticket_repo.find_by_id_for_update(event.ticket_id)
                    if ticket.status != TicketStatus.pending:
                        logger.info(
                            f"[TicketHandler] Ticket {event.ticket_id} déjà résolu "
                            f"(status={ticket.status.value}), skip."
                        )
                        return

                    wrong, pend = await mc_repo.count_wrong_and_pending_by_ticket(event.ticket_id)

                    updated = await ticket_repo.apply_ticket_updates(
                        ticket_id=ticket.id,
                        user_id=ticket.user.id,
                        league_id=ticket.league_id,
                        wrong_count=wrong,
                        pending_count=pend,
                        gain=ticket.gain,
                    )

                    if updated:
                        logger.info(
                            f"[TicketHandler] Ticket {event.ticket_id} résolu "
                            f"(wrong={wrong}, pending={pend})."
                        )
                    else:
                        logger.info(
                            f"[TicketHandler] Ticket {event.ticket_id} — "
                            f"pas de changement (wrong={wrong}, pending={pend})."
                        )
        except Exception:
            logger.exception(
                f"[TicketHandler] Erreur lors du traitement du ticket {event.ticket_id}"
            )
            raise

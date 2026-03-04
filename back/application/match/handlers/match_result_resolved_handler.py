from __future__ import annotations

import logging
from typing import Callable

from sqlalchemy.ext.asyncio import AsyncSession

from domain.match.event.match_result_resolved_event import MatchResultResolvedEvent
from domain.ticket.event.tickets_resolved_event import TicketsResolvedEvent
from application.events.outbox_event_bus import OutboxDomainEventBus
from infrastructure.postgresql.match.match_repository import MatchRepositoryImpl
from infrastructure.postgresql.ticket.match_choices_repository import MatchChoicesRepositoryImpl
from infrastructure.postgresql.ticket.ticket_repository import TicketRepositoryImpl

logger = logging.getLogger(__name__)


class OnMatchResultResolvedCheckChoices:

    def __init__(self, session_factory: Callable[[], AsyncSession]):
        self._session_factory = session_factory

    async def __call__(self, event: MatchResultResolvedEvent) -> None:
        try:
            async with self._session_factory() as session:
                async with session.begin():
                    match_repo = MatchRepositoryImpl(session)
                    mc_repo = MatchChoicesRepositoryImpl(session)
                    ticket_repo = TicketRepositoryImpl(session)
                    outbox_bus = OutboxDomainEventBus(session)

                    match = await match_repo.find_by_id(event.match_id)
                    if not match:
                        logger.warning(f"[MatchHandler] Match {event.match_id} introuvable, skip.")
                        return

                    impacted_ticket_ids = await mc_repo.bulk_resolve_pending_for_match(event.match_id)
                    if not impacted_ticket_ids:
                        logger.info(f"[MatchHandler] Aucun choix résoluble pour match {event.match_id}.")
                        return

                    updated_ticket_ids = await ticket_repo.bulk_resolve_status(impacted_ticket_ids)

                    if updated_ticket_ids:
                        await outbox_bus.publish(
                            TicketsResolvedEvent(
                                ticket_ids=tuple(updated_ticket_ids),
                                match_id=event.match_id,
                            )
                        )

                    logger.info(
                        f"[MatchHandler] Match {event.match_id}: "
                        f"{len(impacted_ticket_ids)} tickets impactés, "
                        f"{len(updated_ticket_ids)} tickets résolus."
                    )
        except Exception:
            logger.exception(f"[MatchHandler] Erreur lors du traitement du match {event.match_id}")
            raise

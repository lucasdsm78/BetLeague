from __future__ import annotations

import logging
from typing import Callable

from sqlalchemy.ext.asyncio import AsyncSession

from domain.match.event.match_result_resolved_event import MatchResultResolvedEvent
from domain.ticket.event.ticket_choices_resolved_event import TicketChoicesResolvedEvent
from domain.ticket.model.match_choice_status import MatchChoiceStatus
from infrastructure.postgresql.match.match_odd_repository import MatchOddRepositoryImpl
from infrastructure.postgresql.match.match_repository import MatchRepositoryImpl
from infrastructure.postgresql.ticket.match_choices_repository import MatchChoicesRepositoryImpl
from application.events.outbox_event_bus import OutboxDomainEventBus

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
                    odd_repo = MatchOddRepositoryImpl(session)
                    outbox_bus = OutboxDomainEventBus(session)

                    match = await match_repo.find_by_id(event.match_id)
                    if not match:
                        logger.warning(f"[MatchHandler] Match {event.match_id} introuvable, skip.")
                        return

                    pending_choices = await mc_repo.get_match_choices_pending_by_match_id(event.match_id)
                    if not pending_choices:
                        logger.info(f"[MatchHandler] Aucun choix en attente pour match {event.match_id}.")
                        return

                    odd_ids = [c.match_odd_id for c in pending_choices]
                    odds = await odd_repo.find_all_by_ids(odd_ids)
                    odd_dict = {o.id: o for o in odds}

                    status_updates: list[tuple[int, MatchChoiceStatus]] = []
                    updated_ticket_ids: set[int] = set()

                    for choice in pending_choices:
                        odd = odd_dict.get(choice.match_odd_id)
                        if not odd or odd.result is None:
                            continue
                        new_status = MatchChoiceStatus.correct if odd.result == "WIN" else MatchChoiceStatus.wrong
                        status_updates.append((choice.id, new_status))
                        updated_ticket_ids.add(choice.ticket_id)

                    if not status_updates:
                        logger.info(f"[MatchHandler] Aucun odd résolu pour match {event.match_id}.")
                        return

                    await mc_repo.bulk_mark_choice_status(status_updates)

                    for tid in updated_ticket_ids:
                        await outbox_bus.publish(
                            TicketChoicesResolvedEvent(ticket_id=tid, match_id=event.match_id)
                        )

                    logger.info(
                        f"[MatchHandler] Match {event.match_id}: "
                        f"{len(status_updates)} choix résolus, "
                        f"{len(updated_ticket_ids)} tickets impactés."
                    )
        except Exception:
            logger.exception(f"[MatchHandler] Erreur lors du traitement du match {event.match_id}")
            raise

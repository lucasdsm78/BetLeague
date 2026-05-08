from __future__ import annotations

import logging
from typing import Callable

from sqlalchemy.ext.asyncio import AsyncSession

from application.events.outbox_event_bus import OutboxDomainEventBus
from application.league.league_overtake_events import build_overtaken_events
from domain.ticket.event.ticket_resolved_event import TicketResolvedEvent
from domain.ticket.event.ticket_choices_resolved_event import TicketChoicesResolvedEvent
from domain.ticket.model.ticket_status import TicketStatus
from infrastructure.postgresql.league.league_players_repository import LeaguePlayersRepositoryImpl
from infrastructure.postgresql.league.league_repository import LeagueRepositoryImpl
from infrastructure.postgresql.ticket.match_choices_repository import MatchChoicesRepositoryImpl
from infrastructure.postgresql.ticket.ticket_repository import TicketRepositoryImpl
from infrastructure.postgresql.user.user_repository import UserRepositoryImpl

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
                    user_repo = UserRepositoryImpl(session)
                    league_players_repo = LeaguePlayersRepositoryImpl(session)
                    league_repo = LeagueRepositoryImpl(session)
                    outbox_bus = OutboxDomainEventBus(session)

                    ticket = await ticket_repo.find_by_id_for_update(event.ticket_id)
                    if ticket.status != TicketStatus.pending:
                        logger.info(
                            f"[TicketHandler] Ticket {event.ticket_id} déjà résolu "
                            f"(status={ticket.status.value}), skip."
                        )
                        return

                    wrong, pend = await mc_repo.count_wrong_and_pending_by_ticket(event.ticket_id)

                    updated = await ticket_repo.resolve_status(
                        ticket_id=ticket.id,
                        wrong_count=wrong,
                        pending_count=pend,
                    )

                    if updated:
                        is_win = wrong == 0
                        before_ranking = []
                        league_name = ""

                        if is_win:
                            await user_repo.apply_ticket_win(ticket.user.id, ticket.gain)
                        else:
                            await user_repo.apply_ticket_lose(ticket.user.id)

                        if ticket.league_id is not None:
                            if is_win:
                                before_ranking = await league_players_repo.get_league_ranking_entries(ticket.league_id)
                                league = await league_repo.find_by_id(ticket.league_id)
                                league_name = league.name if league is not None else ""
                                await league_players_repo.apply_ticket_win(
                                    ticket.league_id,
                                    ticket.user.id,
                                    ticket.gain,
                                )
                                after_ranking = await league_players_repo.get_league_ranking_entries(ticket.league_id)
                                for overtaken_event in build_overtaken_events(
                                    before_entries=before_ranking,
                                    after_entries=after_ranking,
                                    league_id=ticket.league_id,
                                    league_name=league_name,
                                    overtaken_by_user_id=ticket.user.id,
                                    overtaken_by_pseudo=ticket.user.pseudo,
                                ):
                                    await outbox_bus.publish(overtaken_event)
                            else:
                                await league_players_repo.apply_ticket_lose(ticket.league_id, ticket.user.id)

                        await outbox_bus.publish(
                            TicketResolvedEvent(
                                ticket_id=ticket.id,
                                user_id=ticket.user.id,
                                league_id=ticket.league_id,
                                is_win=is_win,
                                gain=float(ticket.gain or 0),
                            )
                        )
                        logger.info(
                            f"[TicketHandler] Ticket {event.ticket_id} résolu "
                            f"(wrong={wrong}, pending={pend}, is_win={is_win})."
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

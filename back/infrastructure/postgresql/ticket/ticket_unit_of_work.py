from __future__ import annotations

from typing import Callable

from sqlalchemy.ext.asyncio import AsyncSession

from application.events.outbox_event_bus import OutboxDomainEventBus
from domain.ticket.unit_of_work import TicketUnitOfWork
from infrastructure.postgresql.league.league_players_repository import LeaguePlayersRepositoryImpl
from infrastructure.postgresql.league.league_repository import LeagueRepositoryImpl
from infrastructure.postgresql.match.match_odd_repository import MatchOddRepositoryImpl
from infrastructure.postgresql.match.match_repository import MatchRepositoryImpl
from infrastructure.postgresql.ticket.match_choices_repository import MatchChoicesRepositoryImpl
from infrastructure.postgresql.ticket.ticket_repository import TicketRepositoryImpl
from infrastructure.postgresql.tournament.tournament_match_repository import TournamentMatchRepositoryImpl
from infrastructure.postgresql.tournament.tournament_players_repository import TournamentPlayersRepositoryImpl
from infrastructure.postgresql.tournament.tournament_repository import TournamentRepositoryImpl
from infrastructure.postgresql.user.user_repository import UserRepositoryImpl


class TicketUnitOfWorkImpl(TicketUnitOfWork):

    def __init__(self, session_factory: Callable[[], AsyncSession]):
        self._session_factory = session_factory
        self._session: AsyncSession | None = None

    async def __aenter__(self) -> TicketUnitOfWorkImpl:
        self._session = self._session_factory()
        await self._session.begin()
        self.ticket_repo = TicketRepositoryImpl(self._session)
        self.match_choice_repo = MatchChoicesRepositoryImpl(self._session)
        self.match_repo = MatchRepositoryImpl(self._session)
        self.match_odd_repo = MatchOddRepositoryImpl(self._session)
        self.user_repo = UserRepositoryImpl(self._session)
        self.league_repo = LeagueRepositoryImpl(self._session)
        self.league_players_repo = LeaguePlayersRepositoryImpl(self._session)
        self.tournament_repo = TournamentRepositoryImpl(self._session)
        self.tournament_players_repo = TournamentPlayersRepositoryImpl(self._session)
        self.tournament_match_repo = TournamentMatchRepositoryImpl(self._session)
        self.outbox_bus = OutboxDomainEventBus(self._session)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        if exc_type is not None:
            await self._session.rollback()
        await self._session.close()
        self._session = None

    async def commit(self) -> None:
        await self._session.commit()

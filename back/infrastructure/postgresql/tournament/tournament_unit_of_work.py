from __future__ import annotations

from typing import Callable

from sqlalchemy.ext.asyncio import AsyncSession

from domain.tournament.unit_of_work import TournamentUnitOfWork
from infrastructure.postgresql.invitation.invitation_repository import InvitationRepositoryImpl
from infrastructure.postgresql.ticket.ticket_repository import TicketRepositoryImpl
from infrastructure.postgresql.tournament.tournament_match_repository import TournamentMatchRepositoryImpl
from infrastructure.postgresql.tournament.tournament_players_repository import TournamentPlayersRepositoryImpl
from infrastructure.postgresql.tournament.tournament_repository import TournamentRepositoryImpl
from infrastructure.postgresql.tournament.tournament_stage_repository import TournamentStageRepositoryImpl
from infrastructure.postgresql.tournament_subscription.tournament_subscription_repository import TournamentSubscriptionRepositoryImpl
from infrastructure.postgresql.user.user_repository import UserRepositoryImpl


class TournamentUnitOfWorkImpl(TournamentUnitOfWork):

    def __init__(self, session_factory: Callable[[], AsyncSession]):
        self._session_factory = session_factory
        self._session: AsyncSession | None = None

    async def __aenter__(self) -> "TournamentUnitOfWorkImpl":
        self._session = self._session_factory()
        await self._session.begin()
        self.user_repo = UserRepositoryImpl(self._session)
        self.tournament_repo = TournamentRepositoryImpl(self._session)
        self.tournament_players_repo = TournamentPlayersRepositoryImpl(self._session)
        self.tournament_stage_repo = TournamentStageRepositoryImpl(self._session)
        self.tournament_match_repo = TournamentMatchRepositoryImpl(self._session)
        self.invitation_repo = InvitationRepositoryImpl(self._session)
        self.tournament_subscription_repo = TournamentSubscriptionRepositoryImpl(self._session)
        self.ticket_repo = TicketRepositoryImpl(self._session)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        if exc_type is not None and self._session is not None:
            await self._session.rollback()
        if self._session is not None:
            await self._session.close()
        self._session = None

    async def commit(self) -> None:
        if self._session is None:
            raise RuntimeError("TournamentUnitOfWork not initialized")
        await self._session.commit()


from __future__ import annotations

from abc import ABC, abstractmethod

from domain.invitation.repository.invitation_repository import InvitationRepository
from domain.ticket.repository.ticket_repository import TicketRepository
from domain.tournament.repository.tournament_match_repository import TournamentMatchRepository
from domain.tournament.repository.tournament_players_repository import TournamentPlayersRepository
from domain.tournament.repository.tournament_repository import TournamentRepository
from domain.tournament.repository.tournament_stage_repository import TournamentStageRepository
from domain.tournament_subscription.repository.tournament_subscription_repository import TournamentSubscriptionRepository
from domain.user.repository.user_repository import UserRepository


class TournamentUnitOfWork(ABC):
    user_repo: UserRepository
    tournament_repo: TournamentRepository
    tournament_players_repo: TournamentPlayersRepository
    tournament_stage_repo: TournamentStageRepository
    tournament_match_repo: TournamentMatchRepository
    invitation_repo: InvitationRepository
    tournament_subscription_repo: TournamentSubscriptionRepository
    ticket_repo: TicketRepository

    @abstractmethod
    async def __aenter__(self) -> "TournamentUnitOfWork":
        raise NotImplementedError

    @abstractmethod
    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        raise NotImplementedError

    @abstractmethod
    async def commit(self) -> None:
        raise NotImplementedError


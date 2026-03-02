from __future__ import annotations

from abc import ABC, abstractmethod

from application.events.event_bus import DomainEventBus
from domain.league.repository.league_players_repository import LeaguePlayersRepository
from domain.league.repository.league_repository import LeagueRepository
from domain.match.repository.match_odd_repository import MatchOddRepository
from domain.match.repository.match_repository import MatchRepository
from domain.ticket.repository.match_choice_repository import MatchChoiceRepository
from domain.ticket.repository.ticket_repository import TicketRepository
from domain.tournament.repository.tournament_match_repository import TournamentMatchRepository
from domain.tournament.repository.tournament_players_repository import TournamentPlayersRepository
from domain.tournament.repository.tournament_repository import TournamentRepository
from domain.user.repository.user_repository import UserRepository


class TicketUnitOfWork(ABC):
    ticket_repo: TicketRepository
    match_choice_repo: MatchChoiceRepository
    match_repo: MatchRepository
    match_odd_repo: MatchOddRepository
    user_repo: UserRepository
    league_repo: LeagueRepository
    league_players_repo: LeaguePlayersRepository
    tournament_repo: TournamentRepository
    tournament_players_repo: TournamentPlayersRepository
    tournament_match_repo: TournamentMatchRepository
    outbox_bus: DomainEventBus

    @abstractmethod
    async def __aenter__(self) -> TicketUnitOfWork:
        raise NotImplementedError

    @abstractmethod
    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        raise NotImplementedError

    @abstractmethod
    async def commit(self) -> None:
        raise NotImplementedError

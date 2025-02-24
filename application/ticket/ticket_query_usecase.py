from abc import ABC, abstractmethod
from typing import List, Dict, Optional

from pydantic import BaseModel

from application.league.league_query_model import LeagueReadModel
from application.league.league_summary import LeagueSummary
from application.match.match_summary import MatchSummary
from application.ticket.match_choice_summary import MatchChoiceSummary
from application.ticket.ticket_query_model import TicketReadModel
from domain.league.exception.league_exception import LeagueParticipantNotFoundError, LeagueNotFoundError
from domain.league.repository.league_players_repository import LeaguePlayersRepository
from domain.league.repository.league_repository import LeagueRepository
from domain.match.repository.match_repository import MatchRepository
from domain.ticket.exception.ticket_exception import TicketNotFoundError, TicketAccessDeniedError
from domain.ticket.repository.match_choice_repository import MatchChoiceRepository
from domain.ticket.repository.ticket_repository import TicketRepository
from domain.user.exception.user_exception import UserNotFoundError
from domain.user.repository.user_repository import UserRepository


class TicketQueryUseCase(ABC):

    @abstractmethod
    def get_ticket_details(self, ticket_id: int, email: str) -> Optional[TicketReadModel]:
        raise NotImplementedError


class TicketQueryUseCaseImpl(TicketQueryUseCase, BaseModel):
    ticket_repository: TicketRepository
    user_repository: UserRepository
    league_repository: LeagueRepository
    match_repository: MatchRepository
    match_choice_repository: MatchChoiceRepository

    class Config:
        arbitrary_types_allowed = True

    def get_ticket_details(self, ticket_id: int, email: str) -> Optional[TicketReadModel]:
        try:
            user = self.user_repository.find_by_email(email)
            if not user:
                raise UserNotFoundError

            ticket = self.ticket_repository.find_by_id(ticket_id)
            if not ticket:
                raise TicketNotFoundError

            if ticket.user.id != user.id:
                raise TicketAccessDeniedError

            league = self.league_repository.find_by_id(ticket.league_id)
            if not league:
                raise LeagueNotFoundError

            league_summary = LeagueSummary(id=league.id, name=league.name)

            match_choices = self.match_choice_repository.find_all_by_ticket_id(ticket_id)
            match_choice_summaries = []
            for match_choice in match_choices:
                match = self.match_repository.find_by_id(match_choice.match_id)

                match_summary = MatchSummary(
                    id=match.id,
                    home_team=match.home_team,
                    away_team=match.away_team,
                    time=match.time,
                    winner=match.winner,
                )

                match_choice_summary = MatchChoiceSummary(
                    id=match_choice.id,
                    match_summary=match_summary,
                    choice=match_choice.choice,
                    status=match_choice.status.value
                )

                match_choice_summaries.append(match_choice_summary)

            return TicketReadModel(
                id=ticket.id,
                mise=ticket.mise,
                uuid=ticket.uuid,
                gain=ticket.gain,
                status=ticket.status.value,
                league_summary=league_summary,
                match_choice_summaries=match_choice_summaries
            )

        except Exception:
            raise

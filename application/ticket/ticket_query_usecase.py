from abc import ABC, abstractmethod
from typing import List, Optional, Callable

from pydantic import BaseModel

from sqlalchemy.ext.asyncio import AsyncSession
from application.league.league_summary import LeagueSummary
from application.match.match_summary import MatchSummary
from application.ticket.match_choice_summary import MatchChoiceSummary
from application.ticket.ticket_query_model import TicketReadModel
from domain.league.exception.league_exception import LeagueNotFoundError
from domain.league.repository.league_repository import LeagueRepository
from domain.match.repository.match_repository import MatchRepository
from domain.ticket.exception.ticket_exception import TicketNotFoundError, TicketAccessDeniedError
from domain.ticket.repository.match_choice_repository import MatchChoiceRepository
from domain.ticket.repository.ticket_repository import TicketRepository
from domain.user.exception.user_exception import UserNotFoundError
from domain.user.repository.user_repository import UserRepository
from infrastructure.postgresql.league.league_repository import LeagueRepositoryImpl
from infrastructure.postgresql.match.match_repository import MatchRepositoryImpl
from infrastructure.postgresql.ticket.match_choices_repository import MatchChoicesRepositoryImpl
from infrastructure.postgresql.ticket.ticket_repository import TicketRepositoryImpl
from infrastructure.postgresql.user.user_repository import UserRepositoryImpl


class TicketQueryUseCase(ABC):

    @abstractmethod
    def get_ticket_details(self, ticket_id: int, email: str) -> Optional[TicketReadModel]:
        raise NotImplementedError


class TicketQueryUseCaseImpl(TicketQueryUseCase):

    def __init__(
            self,
            session_factory: Callable[[], AsyncSession],
            ticket_repository: TicketRepository,
            league_repository: LeagueRepository,
            user_repository: UserRepository,
            match_choices_repository: MatchChoiceRepository,
            match_repository: MatchRepository,
    ):
        self.ticket_repository: TicketRepository = ticket_repository
        self._session_factory = session_factory
        self.user_repository: UserRepository = user_repository
        self.league_repository: LeagueRepository = league_repository
        self.match_choices_repository: MatchChoiceRepository = match_choices_repository
        self.match_repository: MatchRepository = match_repository

    class Config:
        arbitrary_types_allowed = True

    async def get_ticket_details(
            self,
            ticket_id: int,
            email: str
    ) -> Optional[TicketReadModel]:
        async with self._session_factory() as session:
            async with session.begin():
                user_repo           = UserRepositoryImpl(session)
                ticket_repo         = TicketRepositoryImpl(session)
                league_repo         = LeagueRepositoryImpl(session)
                match_choices_repo  = MatchChoicesRepositoryImpl(session)
                match_repo          = MatchRepositoryImpl(session)

                user = await user_repo.find_by_email(email)
                if not user:
                    raise UserNotFoundError

                ticket = await ticket_repo.find_by_id(ticket_id)
                if not ticket:
                    raise TicketNotFoundError

                if ticket.user.id != user.id:
                    raise TicketAccessDeniedError

                league = await league_repo.find_by_id(ticket.league_id)
                if not league:
                    raise LeagueNotFoundError
                league_summary = LeagueSummary(id=league.id, name=league.name)

                choices = await match_choices_repo.find_all_by_ticket_id(ticket_id)
                match_choice_summaries: List[MatchChoiceSummary] = []
                for mc in choices:
                    match = await match_repo.find_by_id(mc.match_id)
                    match_summary = MatchSummary(
                        id=match.id,
                        home_team=match.home_team,
                        away_team=match.away_team,
                        time=match.time,
                        winner=match.winner,
                    )
                    match_choice_summaries.append(
                        MatchChoiceSummary(
                            id=mc.id,
                            match_summary=match_summary,
                            choice=mc.choice,
                            status=mc.status.value
                        )
                    )

                return TicketReadModel(
                    id=ticket.id,
                    uuid=ticket.uuid,
                    mise=ticket.mise,
                    gain=ticket.gain,
                    status=ticket.status.value,
                    league_summary=league_summary,
                    match_choice_summaries=match_choice_summaries
                )

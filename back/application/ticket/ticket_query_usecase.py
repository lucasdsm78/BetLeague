from abc import ABC, abstractmethod
from typing import List, Optional, Callable

from sqlalchemy.ext.asyncio import AsyncSession
from application.league.league_summary import LeagueSummary
from application.match.match_summary import MatchSummary
from application.ticket.match_choice_summary import MatchChoiceSummary
from application.ticket.ticket_query_model import TicketReadModel, TicketsInProgressResponse, TicketsFinishedResponse
from application.tournament.tournament_match_summary import TournamentMatchSummary
from domain.league.exception.league_exception import LeagueNotFoundError
from domain.league.repository.league_repository import LeagueRepository
from domain.match.repository.match_repository import MatchRepository
from domain.ticket.exception.ticket_exception import TicketNotFoundError, TicketAccessDeniedError
from domain.ticket.repository.match_choice_repository import MatchChoiceRepository
from domain.ticket.repository.ticket_repository import TicketRepository
from domain.tournament.exception.tournament_exception import TournamentMatchNotFoundError
from domain.user.exception.user_exception import UserNotFoundError
from domain.user.repository.user_repository import UserRepository
from infrastructure.postgresql.league.league_repository import LeagueRepositoryImpl
from infrastructure.postgresql.match.match_repository import MatchRepositoryImpl
from infrastructure.postgresql.match.match_odd_repository import MatchOddRepositoryImpl
from infrastructure.postgresql.ticket.match_choices_repository import MatchChoicesRepositoryImpl
from infrastructure.postgresql.ticket.ticket_repository import TicketRepositoryImpl
from infrastructure.postgresql.tournament.tournament_match_repository import TournamentMatchRepositoryImpl
from infrastructure.postgresql.user.user_repository import UserRepositoryImpl
from application.match.match_odd_summary import MatchOddSummary


def _odd_to_summary(odd) -> MatchOddSummary:
    bet_type = odd.bet_type.value if hasattr(odd.bet_type, "value") else str(odd.bet_type)
    return MatchOddSummary(bet_type=str(bet_type), bet_name=str(odd.bet_name))


def _build_odd_map(odds) -> dict[int, object]:
    return {o.id: o for o in odds if o and getattr(o, "id", None) is not None}


def _get_match_odd_summary(odd_map: dict[int, object], odd_id: Optional[int]) -> Optional[MatchOddSummary]:
    if not odd_id:
        return None
    odd = odd_map.get(int(odd_id))
    return _odd_to_summary(odd) if odd else None


class TicketQueryUseCase(ABC):

    @abstractmethod
    def get_ticket_details(self, ticket_id: int, email: str) -> Optional[TicketReadModel]:
        raise NotImplementedError

    @abstractmethod
    async def get_tickets_in_progress(self, email: str, page: int = 1, page_size: int = 20) -> TicketsInProgressResponse:
        raise NotImplementedError

    @abstractmethod
    async def get_tickets_finished(self, email: str, page: int = 1, page_size: int = 20) -> TicketsFinishedResponse:
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
                user_repo = UserRepositoryImpl(session)
                ticket_repo = TicketRepositoryImpl(session)
                league_repo = LeagueRepositoryImpl(session)
                match_choices_repo = MatchChoicesRepositoryImpl(session)
                match_repo = MatchRepositoryImpl(session)
                match_odd_repo = MatchOddRepositoryImpl(session)
                tournament_match_repo = TournamentMatchRepositoryImpl(session)

                user = await user_repo.find_by_email(email)
                if not user:
                    raise UserNotFoundError

                ticket = await ticket_repo.find_by_id(ticket_id)
                if not ticket:
                    raise TicketNotFoundError

                if ticket.user.id != user.id:
                    raise TicketAccessDeniedError

                league_summary = None
                tournament_match_summary = None

                if ticket.league_id:
                    league = await league_repo.find_by_id(ticket.league_id)
                    if not league:
                        raise LeagueNotFoundError
                    league_summary = LeagueSummary(id=league.id, name=league.name)

                if ticket.tournament_match_id:
                    tournament_match = await tournament_match_repo.find_by_id(ticket.tournament_match_id)
                    if not tournament_match:
                        raise TournamentMatchNotFoundError
                    tournament_match_summary = TournamentMatchSummary(
                        tournament_match_id=tournament_match.id,
                        tournament_id=tournament_match.tournament_id,
                        type=tournament_match.type.value,
                        stage_id=tournament_match.stage_id
                    )

                choices = await match_choices_repo.find_all_by_ticket_id(ticket_id)

                match_ids = [choice.match_id for choice in choices]
                matches = await match_repo.find_all_by_ids(match_ids)
                match_map = {match.id: match for match in matches}

                odd_ids = [c.match_odd_id for c in choices if getattr(c, 'match_odd_id', None)]
                odds = await match_odd_repo.find_all_by_ids(list({int(x) for x in odd_ids})) if odd_ids else []
                odd_map = _build_odd_map(odds)

                match_choice_summaries = []
                for mc in choices:
                    match = match_map.get(mc.match_id)
                    if not match:
                        continue

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
                            status=mc.status.value,
                            match_odd_summary=_get_match_odd_summary(odd_map, mc.match_odd_id)
                        )
                    )

                return TicketReadModel(
                    id=ticket.id,
                    uuid=ticket.uuid,
                    mise=ticket.mise,
                    gain=ticket.gain,
                    status=ticket.status.value,
                    league_summary=league_summary,
                    tournament_match_summary=tournament_match_summary,
                    match_choice_summaries=match_choice_summaries
                )

    async def get_tickets_in_progress(self, email: str, page: int = 1, page_size: int = 20) -> TicketsInProgressResponse:
        async with self._session_factory() as session:
            async with session.begin():
                user_repo          = UserRepositoryImpl(session)
                ticket_repo        = TicketRepositoryImpl(session)
                tournament_match_repo = TournamentMatchRepositoryImpl(session)
                match_odd_repo = MatchOddRepositoryImpl(session)

                user = await user_repo.find_by_email(email)
                if not user:
                    raise UserNotFoundError

                total = await ticket_repo.count_in_progress_by_user_id(user.id)
                db_tickets = await ticket_repo.find_all_in_progress_by_user_id(user.id, page, page_size)

                result = TicketsInProgressResponse(total=total, page=page, page_size=page_size)
                if not db_tickets:
                    return result

                all_odd_ids: set[int] = set()
                for t in db_tickets:
                    for ch in getattr(t, 'match_choices', []) or []:
                        oid = getattr(ch, 'match_odd_id', None)
                        if oid:
                            all_odd_ids.add(int(oid))

                odds = await match_odd_repo.find_all_by_ids(list(all_odd_ids)) if all_odd_ids else []
                odd_map = _build_odd_map(odds)

                for db_ticket in db_tickets:
                    league_summary = None
                    tournament_match_summary = None

                    if db_ticket.league:
                        league_summary = LeagueSummary(id=db_ticket.league.id, name=db_ticket.league.name)

                    if db_ticket.tournament_match_id:
                        tournament_match = await tournament_match_repo.find_by_id(db_ticket.tournament_match_id)
                        if not tournament_match:
                            raise TournamentMatchNotFoundError
                        tournament_match_summary = TournamentMatchSummary(
                            tournament_match_id=tournament_match.id,
                            tournament_id=tournament_match.tournament_id,
                            type=tournament_match.type.value,
                            stage_id=tournament_match.stage_id
                        )

                    match_choice_summaries: List[MatchChoiceSummary] = []
                    for db_choice in db_ticket.match_choices:
                        match = db_choice.match
                        if not match:
                            continue

                        match_summary = MatchSummary(
                            id=match.id,
                            home_team=match.home_team,
                            away_team=match.away_team,
                            time=match.time,
                            winner=match.winner,
                        )

                        match_choice_summaries.append(
                            MatchChoiceSummary(
                                id=db_choice.id,
                                match_summary=match_summary,
                                choice=db_choice.choice,
                                status=db_choice.status,
                                match_odd_summary=_get_match_odd_summary(odd_map, getattr(db_choice, 'match_odd_id', None))
                            )
                        )

                    ticket_read_model = TicketReadModel(
                        id=db_ticket.id,
                        uuid=db_ticket.uuid,
                        mise=db_ticket.mise,
                        gain=db_ticket.gain,
                        status=db_ticket.status,
                        league_summary=league_summary,
                        tournament_match_summary=tournament_match_summary,
                        match_choice_summaries=match_choice_summaries
                    )
                    result.tickets.append(ticket_read_model)

                return result

    async def get_tickets_finished(self, email: str, page: int = 1, page_size: int = 20) -> TicketsFinishedResponse:
        async with self._session_factory() as session:
            async with session.begin():
                user_repo   = UserRepositoryImpl(session)
                ticket_repo = TicketRepositoryImpl(session)
                tournament_match_repo = TournamentMatchRepositoryImpl(session)
                match_odd_repo = MatchOddRepositoryImpl(session)

                user = await user_repo.find_by_email(email)
                if not user:
                    raise UserNotFoundError

                total = await ticket_repo.count_finished_by_user_id(user.id)
                result = TicketsFinishedResponse(total=total, page=page, page_size=page_size)

                db_tickets = await ticket_repo.find_all_finished_by_user_id(user.id, page, page_size)
                if not db_tickets:
                    return result

                all_odd_ids: set[int] = set()
                for t in db_tickets:
                    for ch in getattr(t, 'match_choices', []) or []:
                        oid = getattr(ch, 'match_odd_id', None)
                        if oid:
                            all_odd_ids.add(int(oid))

                odds = await match_odd_repo.find_all_by_ids(list(all_odd_ids)) if all_odd_ids else []
                odd_map = _build_odd_map(odds)

                for db_ticket in db_tickets:
                    league_summary = None
                    tournament_match_summary = None

                    if db_ticket.league:
                        league_summary = LeagueSummary(id=db_ticket.league.id, name=db_ticket.league.name)

                    if db_ticket.tournament_match_id:
                        tournament_match = await tournament_match_repo.find_by_id(db_ticket.tournament_match_id)
                        if not tournament_match:
                            raise TournamentMatchNotFoundError
                        tournament_match_summary = TournamentMatchSummary(
                            tournament_match_id=tournament_match.id,
                            tournament_id=tournament_match.tournament_id,
                            type=tournament_match.type.value,
                            stage_id=tournament_match.stage_id
                        )

                    match_choice_summaries: List[MatchChoiceSummary] = []
                    for db_choice in db_ticket.match_choices:
                        match = db_choice.match  # déjà pré-chargé
                        if not match:
                            continue

                        match_summary = MatchSummary(
                            id=match.id,
                            home_team=match.home_team,
                            away_team=match.away_team,
                            time=match.time,
                            winner=match.winner,
                        )

                        match_choice_summaries.append(
                            MatchChoiceSummary(
                                id=db_choice.id,
                                match_summary=match_summary,
                                choice=db_choice.choice,
                                status=db_choice.status,
                                match_odd_summary=_get_match_odd_summary(odd_map, getattr(db_choice, 'match_odd_id', None))
                            )
                        )

                    ticket_read_model = TicketReadModel(
                        id=db_ticket.id,
                        uuid=db_ticket.uuid,
                        mise=db_ticket.mise,
                        gain=db_ticket.gain,
                        status=db_ticket.status,
                        league_summary=league_summary,
                        tournament_match_summary=tournament_match_summary,
                        match_choice_summaries=match_choice_summaries
                    )

                    result.tickets.append(ticket_read_model)

        return result


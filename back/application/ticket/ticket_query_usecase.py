from abc import ABC, abstractmethod
import logging
from typing import List, Optional, Callable

from sqlalchemy.ext.asyncio import AsyncSession
from application.logging_utils import hash_identifier
from application.league.league_summary import LeagueSummary
from application.match.match_summary import MatchSummary
from application.ticket.match_choice_summary import MatchChoiceSummary
from application.ticket.ticket_query_model import TicketReadModel, TicketsInProgressResponse, TicketsFinishedResponse, SharedTicketReadModel
from application.tournament.tournament_match_summary import TournamentMatchSummary
from domain.league.exception.league_exception import LeagueNotFoundError
from domain.league.repository.league_repository import LeagueRepository
from domain.match.repository.match_repository import MatchRepository
from domain.ticket.exception.ticket_exception import TicketNotFoundError, TicketAccessDeniedError, TicketNotShareableError
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
from domain.ticket.model.ticket_status import TicketStatus


logger = logging.getLogger(__name__)


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


def _build_tournament_match_summary(tm) -> TournamentMatchSummary:
    tournament = getattr(tm, 'tournament', None)
    tournament_name = getattr(tournament, 'name', None) if tournament is not None else None
    match_type = tm.type.value if hasattr(tm.type, 'value') else tm.type
    return TournamentMatchSummary(
        tournament_match_id=tm.id,
        tournament_id=tm.tournament_id,
        name=tournament_name,
        type=str(match_type),
        stage_id=tm.stage_id,
    )


class TicketQueryUseCase(ABC):

    @abstractmethod
    def get_ticket_details(self, ticket_id: int, email: str) -> Optional[TicketReadModel]:
        raise NotImplementedError

    @abstractmethod
    async def get_tickets_in_progress(
            self,
            email: str,
            page: int = 1,
            page_size: int = 20,
            league_id: Optional[int] = None,
            is_tournament: Optional[bool] = None,
    ) -> TicketsInProgressResponse:
        raise NotImplementedError

    @abstractmethod
    async def get_tickets_finished(
            self,
            email: str,
            page: int = 1,
            page_size: int = 20,
            league_id: Optional[int] = None,
            is_tournament: Optional[bool] = None,
    ) -> TicketsFinishedResponse:
        raise NotImplementedError

    @abstractmethod
    async def get_shared_ticket_details(self, ticket_uuid: str) -> SharedTicketReadModel:
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

    @staticmethod
    async def _get_ticket_display_numbers(ticket_repo, user_id: int, ticket_ids: List[int]) -> dict[int, int]:
        if not ticket_ids:
            return {}

        get_display_numbers = getattr(ticket_repo, 'get_display_numbers_by_ticket_ids', None)
        if callable(get_display_numbers):
            return await get_display_numbers(user_id, ticket_ids)

        ordered_ids = sorted({int(ticket_id) for ticket_id in ticket_ids})
        return {ticket_id: index for index, ticket_id in enumerate(ordered_ids, start=1)}

    @staticmethod
    def _ticket_display_number(ticket, fallback_display_numbers: Optional[dict[int, int]] = None) -> int:
        raw_display_number = getattr(ticket, 'display_number', None)
        if raw_display_number is not None:
            return int(raw_display_number)

        ticket_id = getattr(ticket, 'id', None)
        if ticket_id is not None and fallback_display_numbers is not None and int(ticket_id) in fallback_display_numbers:
            return int(fallback_display_numbers[int(ticket_id)])

        return int(ticket_id or 0)

    async def _build_ticket_read_model_from_ticket(
            self,
            session: AsyncSession,
            ticket,
            *,
            include_internal_id: bool,
            display_number: Optional[int] = None,
    ) -> TicketReadModel | SharedTicketReadModel:
        league_repo = LeagueRepositoryImpl(session)
        match_choices_repo = MatchChoicesRepositoryImpl(session)
        match_repo = MatchRepositoryImpl(session)
        match_odd_repo = MatchOddRepositoryImpl(session)
        tournament_match_repo = TournamentMatchRepositoryImpl(session)

        league_summary = None
        tournament_match_summary = None

        if ticket.league_id:
            league = await league_repo.find_by_id(ticket.league_id)
            if not league:
                raise LeagueNotFoundError
            league_summary = LeagueSummary(id=league.id, name=league.name)

        if ticket.tournament_match_id:
            tm = getattr(ticket, 'tournament_match', None)
            if tm is None:
                tournament_match = await tournament_match_repo.find_by_id(ticket.tournament_match_id)
                if not tournament_match:
                    raise TournamentMatchNotFoundError
                tournament_match_summary = _build_tournament_match_summary(tournament_match)
            else:
                tournament_match_summary = _build_tournament_match_summary(tm)

        choices = await match_choices_repo.find_all_by_ticket_id(ticket.id)

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
                    status=mc.status.value if hasattr(mc.status, 'value') else mc.status,
                    match_odd_summary=_get_match_odd_summary(odd_map, mc.match_odd_id)
                )
            )

        payload = dict(
            uuid=ticket.uuid,
            mise=ticket.mise,
            gain=ticket.gain,
            status=ticket.status.value if hasattr(ticket.status, 'value') else ticket.status,
            league_summary=league_summary,
            tournament_match_summary=tournament_match_summary,
            match_choice_summaries=match_choice_summaries,
        )

        if include_internal_id:
            return TicketReadModel(id=ticket.id, display_number=int(display_number or 0), **payload)
        return SharedTicketReadModel(**payload)

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
                    logger.warning("ticket.query.detail_rejected", extra={"ticket_id": ticket_id, "email_hash": hash_identifier(email), "reason": "user_missing"})
                    raise UserNotFoundError

                ticket = await ticket_repo.find_by_id(ticket_id)
                if not ticket:
                    logger.warning("ticket.query.detail_rejected", extra={"ticket_id": ticket_id, "user_id": user.id, "reason": "ticket_missing"})
                    raise TicketNotFoundError

                if ticket.user.id != user.id:
                    logger.warning("ticket.query.detail_rejected", extra={"ticket_id": ticket_id, "user_id": user.id, "owner_user_id": ticket.user.id, "reason": "forbidden"})
                    raise TicketAccessDeniedError

                result = await self._build_ticket_read_model_from_ticket(
                    session,
                    ticket,
                    include_internal_id=True,
                    display_number=self._ticket_display_number(
                        ticket,
                        await self._get_ticket_display_numbers(ticket_repo, user.id, [ticket.id]),
                    ),
                )
                logger.info("ticket.query.detail_loaded", extra={"ticket_id": ticket.id, "user_id": user.id, "match_choices_count": len(result.match_choice_summaries)})
                return result

    async def get_shared_ticket_details(self, ticket_uuid: str) -> SharedTicketReadModel:
        async with self._session_factory() as session:
            async with session.begin():
                ticket_repo = TicketRepositoryImpl(session)

                ticket = await ticket_repo.find_by_uuid(ticket_uuid)
                if not ticket:
                    logger.warning("ticket.query.shared_rejected", extra={"ticket_uuid": ticket_uuid, "reason": "ticket_missing"})
                    raise TicketNotFoundError

                status_value = ticket.status.value if hasattr(ticket.status, 'value') else ticket.status
                if status_value != TicketStatus.correct.value:
                    logger.warning("ticket.query.shared_rejected", extra={"ticket_uuid": ticket_uuid, "ticket_id": ticket.id, "reason": "not_shareable", "status": status_value})
                    raise TicketNotShareableError

                result = await self._build_ticket_read_model_from_ticket(
                    session,
                    ticket,
                    include_internal_id=False,
                )
                logger.info("ticket.query.shared_loaded", extra={"ticket_uuid": ticket_uuid, "ticket_id": ticket.id, "match_choices_count": len(result.match_choice_summaries)})
                return result

    async def get_tickets_in_progress(
            self,
            email: str,
            page: int = 1,
            page_size: int = 20,
            league_id: Optional[int] = None,
            is_tournament: Optional[bool] = None,
    ) -> TicketsInProgressResponse:
        async with self._session_factory() as session:
            async with session.begin():
                user_repo          = UserRepositoryImpl(session)
                ticket_repo        = TicketRepositoryImpl(session)
                match_odd_repo = MatchOddRepositoryImpl(session)

                user = await user_repo.find_by_email(email)
                if not user:
                    logger.warning("ticket.query.in_progress_rejected", extra={"email_hash": hash_identifier(email), "reason": "user_missing"})
                    raise UserNotFoundError

                total = await ticket_repo.count_in_progress_by_user_id(user.id, league_id=league_id, is_tournament=is_tournament)
                db_tickets = await ticket_repo.find_all_in_progress_by_user_id(
                    user.id,
                    page,
                    page_size,
                    league_id=league_id,
                    is_tournament=is_tournament,
                )

                result = TicketsInProgressResponse(total=total, page=page, page_size=page_size)
                if not db_tickets:
                    logger.info("ticket.query.in_progress_loaded", extra={"user_id": user.id, "page": page, "page_size": page_size, "total": total, "results_count": 0, "league_id": league_id, "is_tournament": is_tournament})
                    return result

                all_odd_ids: set[int] = set()
                display_numbers = None
                if any(getattr(t, 'display_number', None) is None for t in db_tickets):
                    display_numbers = await self._get_ticket_display_numbers(ticket_repo, user.id, [int(t.id) for t in db_tickets])
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
                        tm = getattr(db_ticket, 'tournament_match', None)
                        if tm is None:
                            raise TournamentMatchNotFoundError
                        tournament_match_summary = _build_tournament_match_summary(tm)

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
                        display_number=self._ticket_display_number(db_ticket, display_numbers),
                        uuid=db_ticket.uuid,
                        mise=db_ticket.mise,
                        gain=db_ticket.gain,
                        status=db_ticket.status,
                        league_summary=league_summary,
                        tournament_match_summary=tournament_match_summary,
                        match_choice_summaries=match_choice_summaries
                    )
                    result.tickets.append(ticket_read_model)

                logger.info("ticket.query.in_progress_loaded", extra={"user_id": user.id, "page": page, "page_size": page_size, "total": total, "results_count": len(result.tickets), "league_id": league_id, "is_tournament": is_tournament})
                return result

    async def get_tickets_finished(
            self,
            email: str,
            page: int = 1,
            page_size: int = 20,
            league_id: Optional[int] = None,
            is_tournament: Optional[bool] = None,
    ) -> TicketsFinishedResponse:
        async with self._session_factory() as session:
            async with session.begin():
                user_repo   = UserRepositoryImpl(session)
                ticket_repo = TicketRepositoryImpl(session)
                match_odd_repo = MatchOddRepositoryImpl(session)

                user = await user_repo.find_by_email(email)
                if not user:
                    logger.warning("ticket.query.finished_rejected", extra={"email_hash": hash_identifier(email), "reason": "user_missing"})
                    raise UserNotFoundError

                total = await ticket_repo.count_finished_by_user_id(user.id, league_id=league_id, is_tournament=is_tournament)
                result = TicketsFinishedResponse(total=total, page=page, page_size=page_size)

                db_tickets = await ticket_repo.find_all_finished_by_user_id(
                    user.id,
                    page,
                    page_size,
                    league_id=league_id,
                    is_tournament=is_tournament,
                )
                if not db_tickets:
                    logger.info("ticket.query.finished_loaded", extra={"user_id": user.id, "page": page, "page_size": page_size, "total": total, "results_count": 0, "league_id": league_id, "is_tournament": is_tournament})
                    return result

                all_odd_ids: set[int] = set()
                display_numbers = None
                if any(getattr(t, 'display_number', None) is None for t in db_tickets):
                    display_numbers = await self._get_ticket_display_numbers(ticket_repo, user.id, [int(t.id) for t in db_tickets])
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
                        tm = getattr(db_ticket, 'tournament_match', None)
                        if tm is None:
                            raise TournamentMatchNotFoundError
                        tournament_match_summary = _build_tournament_match_summary(tm)

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
                        display_number=self._ticket_display_number(db_ticket, display_numbers),
                        uuid=db_ticket.uuid,
                        mise=db_ticket.mise,
                        gain=db_ticket.gain,
                        status=db_ticket.status,
                        league_summary=league_summary,
                        tournament_match_summary=tournament_match_summary,
                        match_choice_summaries=match_choice_summaries
                    )

                    result.tickets.append(ticket_read_model)

        logger.info("ticket.query.finished_loaded", extra={"user_id": user.id, "page": page, "page_size": page_size, "total": total, "results_count": len(result.tickets), "league_id": league_id, "is_tournament": is_tournament})
        return result


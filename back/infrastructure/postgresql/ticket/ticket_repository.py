from typing import List, Optional
from sqlalchemy.orm import joinedload, selectinload

from sqlalchemy import select, update, func, case, or_
from sqlalchemy.ext.asyncio import AsyncSession

from domain.ticket.exception.ticket_exception import TicketNotFoundError
from domain.ticket.model.ticket import Ticket
from domain.ticket.model.ticket_status import TicketStatus
from domain.ticket.repository.ticket_repository import TicketRepository
from infrastructure.postgresql.ticket.db_match_choices import DBMatchChoices
from infrastructure.postgresql.ticket.db_ticket import DBTicket
from infrastructure.postgresql.tournament.db_tournament_match import DBTournamentMatch
from domain.ticket.model.match_choice_status import MatchChoiceStatus


class TicketRepositoryImpl(TicketRepository):

    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def create(self, ticket: Ticket) -> int:
        ticket_db = DBTicket.from_entity(ticket)
        self.session.add(ticket_db)
        await self.session.flush()
        return ticket_db.id

    async def find_by_id(self, ticket_id: int) -> Ticket:
        q = (
            select(DBTicket)
            .options(
                joinedload(DBTicket.user),
                joinedload(DBTicket.league),
                joinedload(DBTicket.tournament_match).joinedload(DBTournamentMatch.tournament),
                selectinload(DBTicket.match_choices)
            )
            .where(DBTicket.id == ticket_id)
        )
        result = await self.session.execute(q)
        ticket_db = result.scalar_one_or_none()
        if not ticket_db:
            raise TicketNotFoundError
        return ticket_db.to_entity()

    async def find_by_id_for_update(self, ticket_id: int) -> Ticket:
        q = (
            select(DBTicket)
            .options(joinedload(DBTicket.user))
            .where(DBTicket.id == ticket_id)
            .with_for_update()
        )
        result = await self.session.execute(q)
        ticket_db = result.scalar_one_or_none()
        if not ticket_db:
            raise TicketNotFoundError
        return ticket_db.to_entity()

    async def find_by_uuid(self, ticket_uuid: str) -> Optional[Ticket]:
        q = (
            select(DBTicket)
            .options(
                joinedload(DBTicket.user),
                joinedload(DBTicket.league),
                joinedload(DBTicket.tournament_match).joinedload(DBTournamentMatch.tournament),
                joinedload(DBTicket.match_choices),
            )
            .where(DBTicket.uuid == ticket_uuid)
        )

        result = await self.session.execute(q)
        ticket_db = result.unique().scalar_one_or_none()
        if ticket_db is None:
            return None
        return ticket_db.to_entity()

    async def find_by_player_match(self, user_id: int, tournament_match_id: int) -> Optional[Ticket]:
        result = await self.session.execute(
            select(DBTicket).where(
    DBTicket.user_id == user_id,
                DBTicket.tournament_match_id == tournament_match_id
            )
        )
        bet_db = result.scalar_one_or_none()
        return bet_db.to_entity() if bet_db else None

    async def find_all_in_progress_by_user_id(
            self,
            user_id: int,
            page: int = 1,
            page_size: int = 20,
            league_id: Optional[int] = None,
            is_tournament: Optional[bool] = None,
    ) -> List[DBTicket]:
        offset = (page - 1) * page_size

        filters = [
            DBTicket.user_id == user_id,
            DBTicket.status == TicketStatus.pending.value,
        ]
        if league_id is not None:
            filters.append(DBTicket.league_id == int(league_id))
        if is_tournament is True:
            filters.append(DBTicket.tournament_match_id.is_not(None))

        query = (
            select(DBTicket)
            .where(*filters)
            .options(
                selectinload(DBTicket.league),
                selectinload(DBTicket.tournament_match).selectinload(DBTournamentMatch.tournament),
                selectinload(DBTicket.match_choices)
                .selectinload(DBMatchChoices.match)
            )
            .order_by(DBTicket.id)
            .offset(offset)
            .limit(page_size)
        )

        result = await self.session.execute(query)
        return result.scalars().all()

    async def count_in_progress_by_user_id(
            self,
            user_id: int,
            league_id: Optional[int] = None,
            is_tournament: Optional[bool] = None,
    ) -> int:
        filters = [
            DBTicket.user_id == user_id,
            DBTicket.status == TicketStatus.pending.value,
        ]
        if league_id is not None:
            filters.append(DBTicket.league_id == int(league_id))
        if is_tournament is True:
            filters.append(DBTicket.tournament_match_id.is_not(None))

        result = await self.session.execute(select(func.count(DBTicket.id)).where(*filters))
        return result.scalar_one()

    async def find_all_finished_by_user_id(
            self,
            user_id: int,
            page: int = 1,
            page_size: int = 20,
            league_id: Optional[int] = None,
            is_tournament: Optional[bool] = None,
    ) -> List[DBTicket]:
        offset = (page - 1) * page_size

        filters = [
            DBTicket.user_id == user_id,
            DBTicket.status.in_([TicketStatus.correct.value, TicketStatus.wrong.value]),
        ]
        if league_id is not None:
            filters.append(DBTicket.league_id == int(league_id))
        if is_tournament is True:
            filters.append(DBTicket.tournament_match_id.is_not(None))

        query = (
            select(DBTicket)
            .where(*filters)
            .options(
                selectinload(DBTicket.league),
                selectinload(DBTicket.tournament_match).selectinload(DBTournamentMatch.tournament),
                selectinload(DBTicket.match_choices)
                .selectinload(DBMatchChoices.match)
            )
            .order_by(DBTicket.id.desc())
            .offset(offset)
            .limit(page_size)
        )

        result = await self.session.execute(query)
        return result.scalars().all()

    async def count_finished_by_user_id(
            self,
            user_id: int,
            league_id: Optional[int] = None,
            is_tournament: Optional[bool] = None,
    ) -> int:
        filters = [
            DBTicket.user_id == user_id,
            DBTicket.status.in_([TicketStatus.correct.value, TicketStatus.wrong.value]),
        ]
        if league_id is not None:
            filters.append(DBTicket.league_id == int(league_id))
        if is_tournament is True:
            filters.append(DBTicket.tournament_match_id.is_not(None))

        result = await self.session.execute(select(func.count(DBTicket.id)).where(*filters))
        return result.scalar_one()

    async def update(self, ticket: Ticket):
        result = await self.session.execute(
            select(DBTicket).where(DBTicket.id == ticket.id)
        )
        _ticket = result.scalar_one()
        DBTicket.from_entity(ticket, _ticket)

    async def delete(self, ticket_id: int):
        result = await self.session.execute(
            select(DBTicket).where(DBTicket.id == ticket_id)
        )
        ticket = result.scalar_one()
        await self.session.delete(ticket)



    async def apply_ticket_updates(
            self,
            ticket_id: int,
            user_id: int,
            league_id: int,
            wrong_count: int,
            pending_count: int,
            gain: float
    ) -> bool:
        return await self.resolve_status(ticket_id, wrong_count, pending_count)

    async def resolve_status(
            self,
            ticket_id: int,
            wrong_count: int,
            pending_count: int,
    ) -> bool:
        if wrong_count > 0:
            new_status = TicketStatus.wrong.value
        elif pending_count == 0:
            new_status = TicketStatus.correct.value
        else:
            return False

        result = await self.session.execute(
            update(DBTicket)
            .where(
                DBTicket.id == ticket_id,
                DBTicket.status == TicketStatus.pending.value,
            )
            .values(status=new_status)
        )
        return result.rowcount > 0

    async def bulk_resolve_status(self, ticket_ids: List[int]) -> List[int]:
        """Resolve ticket.status for pending tickets based on their match_choices.

        Chunked to avoid huge IN() clauses.
        """
        if not ticket_ids:
            return []

        chunk_size = int(os.getenv("TICKET_RESOLVE_CHUNK_SIZE", "2000"))
        updated_all: list[int] = []

        for i in range(0, len(ticket_ids), chunk_size):
            chunk = ticket_ids[i:i + chunk_size]

            agg = (
                select(
                    DBMatchChoices.ticket_id.label("ticket_id"),
                    func.coalesce(
                        func.sum(
                            case(
                                (DBMatchChoices.status == MatchChoiceStatus.wrong.value, 1),
                                else_=0,
                            )
                        ),
                        0,
                    ).label("wrong_count"),
                    func.coalesce(
                        func.sum(
                            case(
                                (DBMatchChoices.status == MatchChoiceStatus.pending.value, 1),
                                else_=0,
                            )
                        ),
                        0,
                    ).label("pending_count"),
                )
                .where(DBMatchChoices.ticket_id.in_(chunk))
                .group_by(DBMatchChoices.ticket_id)
                .subquery("choice_agg")
            )

            new_status = case(
                (agg.c.wrong_count > 0, TicketStatus.wrong.value),
                (agg.c.pending_count == 0, TicketStatus.correct.value),
                else_=DBTicket.status,
            )

            stmt = (
                update(DBTicket)
                .where(
                    DBTicket.id == agg.c.ticket_id,
                    DBTicket.status == TicketStatus.pending.value,
                    or_(agg.c.wrong_count > 0, agg.c.pending_count == 0),
                )
                .values(status=new_status)
                .execution_options(synchronize_session=False)
                .returning(DBTicket.id)
            )

            res = await self.session.execute(stmt)
            updated_all.extend([row[0] for row in res.fetchall()])

        return updated_all

    async def begin(self):
        await self.session.begin()

    async def commit(self):
        await self.session.commit()

    async def rollback(self):
        await self.session.rollback()

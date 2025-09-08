from typing import List
from sqlalchemy.orm import joinedload
from sqlalchemy import select, update, func, case
from sqlalchemy.ext.asyncio import AsyncSession
from domain.ticket.model.match_choice import MatchChoice
from domain.ticket.model.match_choice_status import MatchChoiceStatus
from domain.ticket.repository.match_choice_repository import MatchChoiceRepository
from infrastructure.postgresql.ticket.db_match_choices import DBMatchChoices


class MatchChoicesRepositoryImpl(MatchChoiceRepository):

    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def create(self, match_choice: MatchChoice):
        match_choice_db = DBMatchChoices.from_entity(match_choice)
        try:
            self.session.add(match_choice_db)
        except:
            raise

    async def find_all_by_ticket_id(self, ticket_id: int) -> List[MatchChoice]:
        q = (
            select(DBMatchChoices)
            .options(joinedload(DBMatchChoices.match))
            .where(DBMatchChoices.ticket_id == ticket_id)
        )
        result = await self.session.execute(q)
        rows = result.scalars().all()

        if not rows:
            return []

        return [row.to_entity() for row in rows]

    async def find_all_by_ticket_ids(self, ticket_ids: List[int]) -> List[MatchChoice]:
        if not ticket_ids:
            return []
        query = select(DBMatchChoices).where(DBMatchChoices.ticket_id.in_(ticket_ids))
        result = await self.session.execute(query)
        return [DBMatchChoices.to_entity(db) for db in result.scalars().all()]

    async def delete_by_ticket_id(self, ticket_id: int):
        try:
            query = select(DBMatchChoices).where(DBMatchChoices.ticket_id == ticket_id)
            result = await self.session.execute(query)
            match_choices = result.scalars().all()
            for match_choice in match_choices:
                await self.session.delete(match_choice)
        except:
            raise

    async def update(self, match_choice: MatchChoice):
        try:
            query = select(DBMatchChoices).where(DBMatchChoices.id == match_choice.id)
            result = await self.session.execute(query)
            _match_choice = result.scalar_one()
            match_choice_db = DBMatchChoices.from_entity(match_choice, _match_choice)
        except:
            raise

    async def get_match_choices_pending_by_match_id(self, match_id: int) -> List[MatchChoice]:
        stmt = (
            select(DBMatchChoices)
            .where(
                DBMatchChoices.match_id == match_id,
                DBMatchChoices.status == MatchChoiceStatus.pending.value
            )
        )

        result = await self.session.execute(stmt)
        rows = result.scalars().all()

        return [db_obj.to_entity() for db_obj in rows]

    async def mark_choice_status(self, choice_id: int, status: MatchChoiceStatus):
        stmt = (
            update(DBMatchChoices)
            .where(DBMatchChoices.id == choice_id)
            .values(status=status.value)
            .execution_options(synchronize_session=False)
        )
        await self.session.execute(stmt)


    async def count_wrong_and_pending_by_ticket(
            self,
            ticket_id: int
    ) -> tuple[int, int]:
        stmt = (
            select(
                # somme des “wrong”
                func.coalesce(
                    func.sum(
                        case(
                            (DBMatchChoices.status == MatchChoiceStatus.wrong.value, 1),
                            else_=0
                        )
                    ),
                    0
                ).label("wrong_count"),
                # somme des “pending”
                func.coalesce(
                    func.sum(
                        case(
                            (DBMatchChoices.status == MatchChoiceStatus.pending.value, 1),
                            else_=0
                        )
                    ),
                    0
                ).label("pending_count"),
            )
            .where(DBMatchChoices.ticket_id == ticket_id)
        )
        result = await self.session.execute(stmt)
        wrong_count, pending_count = result.one()
        return wrong_count, pending_count

    async def begin(self):
        await self.session.begin()

    async def commit(self):
        await self.session.commit()

    async def rollback(self):
        await self.session.rollback()

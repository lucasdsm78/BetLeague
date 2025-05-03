from typing import List
from sqlalchemy.orm import joinedload
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from domain.ticket.model.match_choice import MatchChoice
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

    async def begin(self):
        await self.session.begin()

    async def commit(self):
        await self.session.commit()

    async def rollback(self):
        await self.session.rollback()

from datetime import datetime
from typing import List, Optional
from sqlalchemy import select, exists
import pytz
from sqlalchemy.exc import NoResultFound
from sqlalchemy.ext.asyncio import AsyncSession

from application.ticket.ticket_command_model import MatchChoiceData
from domain.match.exception.match_exception import MatchNotFoundError
from domain.match.model.match import Match
from domain.match.repository.match_repository import MatchRepository
from infrastructure.postgresql.match.db_match import DBMatch


class MatchRepositoryImpl(MatchRepository):

    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def find_match(
            self,
            home_team: str,
            away_team: str,
            cote_home: float,
            cote_draw: float,
            cote_away: float
    ) -> bool:
        try:
            query = select(DBMatch).where(
                DBMatch.home_team == home_team,
                DBMatch.away_team == away_team,
                DBMatch.cote_home == cote_home,
                DBMatch.cote_draw == cote_draw,
                DBMatch.cote_away == cote_away
            )
            result = await self.session.execute(query)
            match_exists = result.scalar_one_or_none() is not None
            return match_exists
        except:
            raise

    async def find_matches(self) -> List[Match]:
        try:
            now = datetime.utcnow()
            query = select(DBMatch).where(DBMatch.time > now)
            result = await self.session.execute(query)
            match_dbs = result.scalars().all()

            if not match_dbs:
                return []

            return [match_db.to_entity() for match_db in match_dbs]
        except:
            raise

    async def find_by_id(self, match_id: int) -> Optional[Match]:
        try:
            result = await self.session.execute(
                select(DBMatch).where(DBMatch.id == match_id)
            )
            match_db = result.scalar_one()
            return match_db.to_entity()
        except NoResultFound:
            raise MatchNotFoundError
        except:
            raise

    async def find_all_by_ids(self, match_ids: List[int]) -> List[Match]:
        if not match_ids:
            return []
        query = select(DBMatch).where(DBMatch.id.in_(match_ids))
        result = await self.session.execute(query)
        return [DBMatch.to_entity(db) for db in result.scalars().all()]

    async def exists_match_started_for_ticket(
            self,
            match_choices: List[MatchChoiceData]
    ) -> bool:
        if not match_choices:
            return False

        now = datetime.utcnow()
        match_ids = [mc.match_id for mc in match_choices]

        query = (
            select(DBMatch)
            .where(
                DBMatch.id.in_(match_ids),
                DBMatch.time <= now
            )
            .limit(1)
        )

        result = await self.session.execute(query)
        return result.scalar_one_or_none() is not None

    async def is_correct_score(self, choice: str, match_id: int) -> bool:
        stmt = select(exists()
                      .where(DBMatch.id == match_id,
                             DBMatch.winner == choice))
        return await self.session.scalar(stmt)

    async def begin(self):
        await self.session.begin()

    async def commit(self):
        await self.session.commit()

    async def rollback(self):
        await self.session.rollback()

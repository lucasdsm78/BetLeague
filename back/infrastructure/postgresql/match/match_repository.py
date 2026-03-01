from datetime import datetime, timedelta
from typing import List, Optional
from sqlalchemy import select, exists, func, or_
import pytz
from sqlalchemy.exc import NoResultFound
from sqlalchemy.ext.asyncio import AsyncSession

from application.ticket.ticket_command_model import MatchChoiceData
from domain.match.exception.match_exception import MatchNotFoundError
from domain.match.model.match import Match
from domain.match.repository.match_repository import MatchRepository
from infrastructure.postgresql.match.db_match import DBMatch, unixtimestamp


class MatchRepositoryImpl(MatchRepository):

    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def count_upcoming_matches(self) -> int:
        now = datetime.utcnow()
        stmt = select(func.count()).select_from(DBMatch).where(DBMatch.time > now)
        result = await self.session.execute(stmt)
        return int(result.scalar_one() or 0)

    async def find_matches_paginated(self, page: int, page_size: int) -> List[Match]:
        now = datetime.utcnow()
        offset = (page - 1) * page_size

        stmt = (
            select(DBMatch)
            .where(DBMatch.time > now)
            .order_by(DBMatch.time.asc())
            .offset(offset)
            .limit(page_size)
        )
        result = await self.session.execute(stmt)
        match_dbs = result.scalars().all()
        return [match_db.to_entity() for match_db in match_dbs]

    async def find_matches(self) -> List[Match]:
        try:
            now = datetime.utcnow()
            query = select(DBMatch).where(DBMatch.time > now).order_by(DBMatch.time.asc())
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

    async def bulk_update_winner(self, updates: list[dict]):

        def _do_bulk(sess):
            sess.bulk_update_mappings(DBMatch, updates)

        await self.session.run_sync(_do_bulk)

    async def get_matches_from_dates(
            self,
            from_date: datetime,
            to_date: datetime
    ) -> List[Match]:
        stmt = (
            select(DBMatch)
            .where(
                DBMatch.time >= from_date,
                DBMatch.time <= to_date
            )
        )
        result = await self.session.execute(stmt)
        db_matches = result.scalars().all()
        return [db.to_entity() for db in db_matches]

    async def find_by_api_fixture_id(self, api_fixture_id: int) -> Optional[Match]:
        result = await self.session.execute(
            select(DBMatch).where(DBMatch.api_fixture_id == api_fixture_id)
        )
        db_match = result.scalar_one_or_none()
        return db_match.to_entity() if db_match else None

    async def upsert_by_api_fixture_id(self, match: Match) -> Match:
        result = await self.session.execute(
            select(DBMatch).where(DBMatch.api_fixture_id == match.api_fixture_id)
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.home_team = match.home_team
            existing.away_team = match.away_team
            existing.time = match.time
            existing.league_name = match.league_name
            existing.league_id = match.league_id
            existing.logo_home = match.logo_home
            existing.logo_away = match.logo_away
            existing.score_home = match.score_home
            existing.score_away = match.score_away
            existing.status = match.status.value if hasattr(match.status, 'value') else str(match.status)
            existing.sport = match.sport.value if hasattr(match.sport, 'value') else str(match.sport)
            existing.season = match.season
            existing.winner = match.winner
            existing.updated_at = unixtimestamp()
            await self.session.flush()
            return existing.to_entity()
        else:
            db_match = DBMatch.from_entity(match)
            self.session.add(db_match)
            await self.session.flush()
            return db_match.to_entity()

    async def find_active_fixture_ids(self) -> List[int]:
        now = datetime.utcnow()
        start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = start_of_day + timedelta(days=1)

        finished_statuses = ('FT', 'AET', 'AP', 'AWD', 'WO', 'CANC', 'ABD', 'PST')

        result = await self.session.execute(
            select(DBMatch.api_fixture_id)
            .where(
                DBMatch.api_fixture_id.isnot(None),
                or_(
                    # Today's matches that are not yet finished (live or upcoming)
                    (DBMatch.time >= start_of_day)
                    & (DBMatch.time <= end_of_day)
                    & DBMatch.status.notin_(finished_statuses),
                    # Any finished match with no winner yet
                    DBMatch.status.in_(finished_statuses)
                    & (DBMatch.winner.is_(None)),
                ),
            )
        )
        return [row[0] for row in result.all()]

    async def find_finished_without_winner(self) -> List[Match]:
        finished_statuses = ('FT', 'AET', 'AP', 'AWD', 'WO')

        result = await self.session.execute(
            select(DBMatch)
            .where(
                DBMatch.status.in_(finished_statuses),
                DBMatch.winner.is_(None),
                DBMatch.score_home.isnot(None),
                DBMatch.score_away.isnot(None),
            )
        )
        return [row.to_entity() for row in result.scalars().all()]

    async def bulk_update_scores(self, updates: list[dict]) -> None:
        def _do_bulk(sess):
            sess.bulk_update_mappings(DBMatch, updates)

        await self.session.run_sync(_do_bulk)

    async def begin(self):
        await self.session.begin()

    async def commit(self):
        await self.session.commit()

    async def rollback(self):
        await self.session.rollback()

from datetime import datetime
from typing import List, Optional
from sqlalchemy import select, func, or_
from sqlalchemy.exc import NoResultFound, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from domain.league.exception.league_exception import LeagueNotFoundError
from domain.league.model.league import League, LeagueStatus
from domain.league.repository.league_repository import LeagueRepository
from infrastructure.postgresql.league.db_league import DBLeague
from infrastructure.postgresql.league.db_league_players import DBLeaguePlayers


class LeagueRepositoryImpl(LeagueRepository):

    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def create(self, league: League):
        league_db = DBLeague.from_entity(league)
        try:
            self.session.add(league_db)
        except:
            raise

    async def find_by_id(self, league_id: int) -> League:
        q = (
            select(DBLeague)
            .options(joinedload(DBLeague.user))   # ← charge aussi .user
            .where(DBLeague.id == league_id)
        )
        result = await self.session.execute(q)
        league_db = result.scalar_one_or_none()
        if not league_db:
            raise LeagueNotFoundError
        return league_db.to_entity()

    async def find_by_name(self, name: str) -> bool:
        try:
            result = await self.session.execute(
                select(DBLeague).where(DBLeague.name == name)
            )
            league_db = result.scalar_one_or_none()
            return league_db is not None
        except:
            raise

    async def count_leagues(self, user_id: int) -> int:
        q = (
            select(func.count())
            .select_from(DBLeague)
            .where(
                DBLeague.is_private == False,
                DBLeague.status == LeagueStatus.OPEN.value,
                DBLeague.user_id != user_id,
                DBLeague.nb_players_remaining > 0,
                DBLeague.id.notin_(
                    select(DBLeaguePlayers.league_id)
                    .where(DBLeaguePlayers.user_id == user_id)
                    .scalar_subquery()
                ),
            )
        )
        result = await self.session.execute(q)
        return int(result.scalar_one() or 0)

    async def count_created_leagues(self, user_id: int) -> int:
        q = select(func.count()).select_from(DBLeague).where(DBLeague.user_id == user_id)
        result = await self.session.execute(q)
        return int(result.scalar_one() or 0)

    async def count_participated_leagues(self, user_id: int) -> int:
        q = (
            select(func.count())
            .select_from(DBLeague)
            .join(DBLeaguePlayers, DBLeague.id == DBLeaguePlayers.league_id)
            .where(
                DBLeaguePlayers.user_id == user_id,
                DBLeague.user_id != user_id,
            )
        )
        result = await self.session.execute(q)
        return int(result.scalar_one() or 0)

    async def find_leagues(
            self, user_id: int, page: int = 1, limit: int = 10
    ) -> List[League]:
        offset = (page - 1) * limit

        query = (
            select(DBLeague)
            .options(joinedload(DBLeague.user))   # ← charger aussi .user
            .where(
                DBLeague.is_private == False,
                DBLeague.status == LeagueStatus.OPEN.value,
                DBLeague.user_id != user_id,
                DBLeague.nb_players_remaining > 0,
                DBLeague.id.notin_(
                    select(DBLeaguePlayers.league_id)
                    .where(DBLeaguePlayers.user_id == user_id)
                    .scalar_subquery()
                ),
                )
            .order_by(DBLeague.created_at.desc())
            .offset(offset)
            .limit(limit)
        )

        result = await self.session.execute(query)
        leagues_dbs = result.scalars().all()

        if not leagues_dbs:
            return []

        return [league_db.to_entity() for league_db in leagues_dbs]

    async def find_created_leagues(
            self, user_id: int, page: int = 1, limit: int = 10
    ) -> List[League]:
        offset = (page - 1) * limit

        query = (
            select(DBLeague)
            .options(joinedload(DBLeague.user))
            .where(DBLeague.user_id == user_id)
            .order_by(DBLeague.created_at.desc())
            .offset(offset)
            .limit(limit)
        )

        result = await self.session.execute(query)
        leagues_dbs = result.scalars().all()

        if not leagues_dbs:
            return []

        return [league_db.to_entity() for league_db in leagues_dbs]

    async def find_participated_leagues(
            self, user_id: int, page: int = 1, limit: int = 10
    ) -> List[League]:
        """Find leagues where the user is a participant (not creator)"""
        offset = (page - 1) * limit

        query = (
            select(DBLeague)
            .options(joinedload(DBLeague.user))
            .join(DBLeaguePlayers, DBLeague.id == DBLeaguePlayers.league_id)
            .where(
                DBLeaguePlayers.user_id == user_id,
                DBLeague.user_id != user_id
            )
            .order_by(DBLeague.created_at.desc())
            .offset(offset)
            .limit(limit)
        )

        result = await self.session.execute(query)
        leagues_dbs = result.scalars().all()

        if not leagues_dbs:
            return []

        return [league_db.to_entity() for league_db in leagues_dbs]

    async def find_by_uuid(self, league_uuid: str) -> Optional[League]:
        q = (
            select(DBLeague)
            .options(joinedload(DBLeague.user))
            .where(DBLeague.uuid == league_uuid)
        )

        try:
            result = await self.session.execute(q)
            league_db = result.scalar_one()
            return league_db.to_entity()
        except NoResultFound:
            raise LeagueNotFoundError

    async def update(self, league: League):
        try:
            result = await self.session.execute(
                select(DBLeague).where(DBLeague.id == league.id)
            )
            _league = result.scalar_one()
            league_db = DBLeague.from_entity(league, _league)
        except:
            raise

    async def find_ended_before_not_paid(self, as_of: datetime) -> List[League]:
        as_of_ms = int(as_of.timestamp() * 1000)
        q = (
            select(DBLeague)
            .options(joinedload(DBLeague.user))
            .where(
                DBLeague.end_date <= as_of_ms,
                DBLeague.status == LeagueStatus.IN_PROGRESS.value,
                DBLeague.closed_at.is_(None),
            )
            .with_for_update(of=DBLeague, skip_locked=True)
        )
        result = await self.session.execute(q)
        leagues_db = result.scalars().all()
        return [l.to_entity() for l in leagues_db]

    async def find_all_by_ids(self, league_ids: List[int]) -> List[League]:
        if not league_ids:
            return []

        query = select(DBLeague).where(DBLeague.id.in_(league_ids))
        result = await self.session.execute(query)
        db_leagues = result.scalars().all()

        leagues = await self.session.run_sync(
            lambda sync_sess, objs: [DBLeague.to_entity(o) for o in objs],
            db_leagues
        )
        return leagues

    async def count_players(self, league_id: int) -> int:
        q = (
            select(func.count())
            .select_from(DBLeaguePlayers)
            .where(DBLeaguePlayers.league_id == league_id)
        )
        result = await self.session.execute(q)
        return result.scalar_one()

    async def get_top_scorer(self, league_id: int) -> tuple[Optional[int], int]:
        q = (
            select(
                DBLeaguePlayers.user_id,
                func.sum(DBLeaguePlayers.nb_btl).label("total")
            )
            .where(DBLeaguePlayers.league_id == league_id)
            .group_by(DBLeaguePlayers.user_id)
            .order_by(func.sum(DBLeaguePlayers.nb_btl).desc(), DBLeaguePlayers.user_id.asc())
            .limit(1)
        )
        result = await self.session.execute(q)
        row = result.one_or_none()
        if not row:
            return None, 0
        return row.user_id, row.total

    async def begin(self):
        await self.session.begin()

    async def commit(self):
        await self.session.commit()

    async def rollback(self):
        await self.session.rollback()

    async def decrement_players_remaining_if_available(self, league_id: int) -> League:
        stmt = (
            select(DBLeague)
            .options(joinedload(DBLeague.user))
            .where(DBLeague.id == league_id)
            .with_for_update(of=DBLeague)
        )
        result = await self.session.execute(stmt)
        league_db = result.scalar_one_or_none()
        if league_db is None:
            raise LeagueNotFoundError

        if int(league_db.nb_players_remaining or 0) <= 0:
            return None

        if league_db.status == LeagueStatus.CLOSED.value:
            return None

        league_db.nb_players_remaining = int(league_db.nb_players_remaining) - 1
        return league_db.to_entity()

    async def increment_players_remaining(self, league_id: int) -> League:
        stmt = (
            select(DBLeague)
            .options(joinedload(DBLeague.user))
            .where(DBLeague.id == league_id)
            .with_for_update(of=DBLeague)
        )
        result = await self.session.execute(stmt)
        league_db = result.scalar_one_or_none()
        if league_db is None:
            raise LeagueNotFoundError

        if league_db.status == LeagueStatus.CLOSED.value:
            return league_db.to_entity()

        league_db.nb_players_remaining = int(league_db.nb_players_remaining or 0) + 1
        return league_db.to_entity()

    async def find_my_leagues(self, user_id: int, page: int = 1, limit: int = 10) -> List[League]:
        if page < 1:
            page = 1
        if limit < 1:
            limit = 1

        offset = (page - 1) * limit

        league_ids_sq = (
            select(DBLeague.id)
            .outerjoin(DBLeaguePlayers, DBLeaguePlayers.league_id == DBLeague.id)
            .where(or_(DBLeague.user_id == user_id, DBLeaguePlayers.user_id == user_id))
            .distinct()
            .subquery()
        )

        q = (
            select(DBLeague)
            .options(joinedload(DBLeague.user))
            .where(DBLeague.id.in_(select(league_ids_sq.c.id)))
            .order_by(DBLeague.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.session.execute(q)
        leagues_dbs = result.scalars().all()
        if not leagues_dbs:
            return []
        return [league_db.to_entity() for league_db in leagues_dbs]

    async def count_my_leagues(self, user_id: int) -> int:
        q = (
            select(func.count(func.distinct(DBLeague.id)))
            .select_from(DBLeague)
            .outerjoin(DBLeaguePlayers, DBLeaguePlayers.league_id == DBLeague.id)
            .where(or_(DBLeague.user_id == user_id, DBLeaguePlayers.user_id == user_id))
        )
        result = await self.session.execute(q)
        return int(result.scalar_one() or 0)

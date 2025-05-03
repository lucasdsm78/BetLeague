from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.exc import NoResultFound, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from domain.league.exception.league_exception import LeagueNotFoundError
from domain.league.model.league import League
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

    async def find_leagues(
            self, user_id: int, page: int = 1, limit: int = 10
    ) -> List[League]:
        offset = (page - 1) * limit

        query = (
            select(DBLeague)
            .options(joinedload(DBLeague.user))   # ← charger aussi .user
            .where(
                DBLeague.is_private == False,
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

    async def begin(self):
        await self.session.begin()

    async def commit(self):
        await self.session.commit()

    async def rollback(self):
        await self.session.rollback()

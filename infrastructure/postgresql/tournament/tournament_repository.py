from typing import Optional, List, Tuple
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload

from domain.tournament.exception.tournament_exception import TournamentNotFoundError
from domain.tournament.model.tournament import Tournament
from domain.tournament.model.tournament_status import TournamentStatus
from domain.tournament.repository.tournament_repository import TournamentRepository
from infrastructure.postgresql.tournament.db_tournament import DBTournament
from infrastructure.postgresql.tournament.db_tournament_player import DBTournamentPlayer


class TournamentRepositoryImpl(TournamentRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, tournament: Tournament):
        db_tournament = DBTournament.from_entity(tournament)
        try:
            self.session.add(db_tournament)
        except:
            raise

    async def find_by_id(self, tournament_id: int) -> Optional[Tournament]:
        result = await self.session.execute(
            select(DBTournament)
            .options(joinedload(DBTournament.user))
            .where(DBTournament.id == tournament_id)
        )
        tournament_db = result.scalar_one_or_none()
        if not tournament_db:
            raise TournamentNotFoundError
        return tournament_db.to_entity()

    async def find_by_name(self, tournament_name: str) -> Optional[Tournament]:
        result = await self.session.execute(
            select(DBTournament)
            .options(joinedload(DBTournament.user))
            .where(DBTournament.name == tournament_name)
        )
        tournament_db = result.scalar_one_or_none()
        if not tournament_db:
            return None
        return tournament_db.to_entity()

    async def find_by_uuid(self, uuid: str) -> Optional[Tournament]:
        result = await self.session.execute(
            select(DBTournament)
            .options(
                selectinload(DBTournament.stages),
                selectinload(DBTournament.players).selectinload(DBTournamentPlayer.user)
            )
            .where(DBTournament.uuid == uuid)
        )
        tournament_db = result.scalar_one_or_none()
        if not tournament_db:
            raise TournamentNotFoundError
        return tournament_db.to_entity()

    async def find_all_by_user_creator(self, user_id: int) -> List[Tournament]:
        result = await self.session.execute(
            select(DBTournament)
            .join(DBTournamentPlayer, DBTournament.id == DBTournamentPlayer.tournament_id)
            .options(
                selectinload(DBTournament.stages),
                selectinload(DBTournament.players)
            )
            .where(DBTournament.user_id == user_id)
        )
        tournaments_db = result.scalars().all()
        return [tournament_db.to_entity() for tournament_db in tournaments_db]

    async def find_all_by_status(self, status: str) -> List[Tournament]:
        result = await self.session.execute(
            select(DBTournament)
            .where(DBTournament.status == status)
        )
        tournaments_db = result.scalars().all()
        return [tournament_db.to_entity() for tournament_db in tournaments_db]

    async def find_all_by_user_participant(
            self,
            user_id: int,
            limit: int,
            offset: int
    ) -> Tuple[List[Tournament], int]:
        stmt = (
            select(
                DBTournament,
                func.count().over().label("total_count")
            )
            .join(
                DBTournamentPlayer,
                DBTournament.id == DBTournamentPlayer.tournament_id
            )
            .where(
                DBTournamentPlayer.user_id == user_id,
                DBTournamentPlayer.is_eliminated.is_(False),
                DBTournament.status == TournamentStatus.IN_PROGRESS.value
            )
            .order_by(DBTournament.created_at.desc())
            .limit(limit)
            .offset(offset)
        )

        result = await self.session.execute(stmt)

        rows = result.all()
        if not rows:
            return [], 0

        total_count = rows[0][1]

        db_tournaments = [row[0] for row in rows]

        tournaments: List[Tournament] = await self.session.run_sync(
            lambda sync_sess, objs: [DBTournament.to_entity(o) for o in objs],
            db_tournaments
        )

        return tournaments, total_count

    async def find_available_tournaments_public(
            self,
            limit: int,
            offset: int
    ) -> Tuple[List[Tournament], int]:
        stmt = (
            select(
                DBTournament,
                func.count().over().label("total_count")
            )
            .where(
                DBTournament.is_private == False,
                DBTournament.current_players < DBTournament.max_players,
                DBTournament.status == TournamentStatus.PENDING.value,
            )
            .order_by(DBTournament.created_at.desc())
            .limit(limit)
            .offset(offset)
        )

        result = await self.session.execute(stmt)

        rows = result.all()
        if not rows:
            return [], 0

        total_count = rows[0][1]

        db_tournaments = [row[0] for row in rows]

        tournaments: List[Tournament] = await self.session.run_sync(
            lambda sync_sess, objs: [DBTournament.to_entity(o) for o in objs],
            db_tournaments
        )

        return tournaments, total_count

    async def find_finished_tournaments(
            self,
            user_id: int,
            limit: int,
            offset: int
    ) -> Tuple[List[Tournament], int]:
        stmt = (
            select(
                DBTournament,
                func.count().over().label("total_count")
            )
            .join(
                DBTournamentPlayer,
                DBTournament.id == DBTournamentPlayer.tournament_id
            )
            .where(
                DBTournamentPlayer.user_id == user_id,
                DBTournament.status == TournamentStatus.COMPLETED.value
            )
            .order_by(DBTournament.end_date.desc())
            .limit(limit)
            .offset(offset)
        )

        result = await self.session.execute(stmt)

        rows = result.all()
        if not rows:
            return [], 0

        total_count = rows[0][1]

        db_tournaments = [row[0] for row in rows]

        tournaments: List[Tournament] = await self.session.run_sync(
            lambda sync_sess, objs: [DBTournament.to_entity(o) for o in objs],
            db_tournaments
        )

        return tournaments, total_count

    async def update(self, tournament: Tournament):
        result = await self.session.execute(
            select(DBTournament).where(DBTournament.id == tournament.id)
        )
        _tournament = result.scalar_one()
        tournament_db = DBTournament.from_entity(tournament, _tournament)

    async def count_players(self, tournament_id: int) -> int:
        result = await self.session.execute(
            select(func.count()).select_from(DBTournamentPlayer).where(
                DBTournamentPlayer.tournament_id == tournament_id
            )
        )
        return result.scalar_one()

    async def begin(self):
        await self.session.begin()

    async def commit(self):
        await self.session.commit()

    async def rollback(self):
        await self.session.rollback()

from typing import Optional, List
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from domain.tournament.exception.tournament_exception import TournamentNotFoundError
from domain.tournament.model.tournament import Tournament
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
        tournament_db = await self.session.get(
            DBTournament,
            tournament_id,
            options=[
                selectinload(DBTournament.stages),
                selectinload(DBTournament.players).selectinload(DBTournamentPlayer.user),
            ],
        )
        if not tournament_db:
            raise TournamentNotFoundError
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

    async def find_all_by_user(self, user_id: int) -> List[Tournament]:
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

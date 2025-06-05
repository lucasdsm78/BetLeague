from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from domain.tournament.model.tournament import Tournament
from domain.tournament.repository.tournament_repository import TournamentRepository
from infrastructure.postgresql.tournament.db_tournament import DBTournament
from infrastructure.postgresql.tournament.db_tournament_player import DBTournamentPlayer


class TournamentRepositoryImpl(TournamentRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, tournament: Tournament):
        db_tournament = DBTournament.from_entity(tournament)
        self.session.add(db_tournament)

    async def find_by_id(self, tournament_id: int) -> Optional[Tournament]:
        result = await self.session.execute(
            select(DBTournament).where(DBTournament.id == tournament_id)
        )
        db_obj = result.scalar_one_or_none()
        return db_obj.to_entity() if db_obj else None

    async def find_by_uuid(self, uuid: str) -> Optional[Tournament]:
        result = await self.session.execute(
            select(DBTournament).where(DBTournament.uuid == uuid)
        )
        db_obj = result.scalar_one_or_none()
        return db_obj.to_entity() if db_obj else None

    async def update(self, tournament: Tournament) -> Optional[Tournament]:
        result = await self.session.execute(
            select(DBTournament).where(DBTournament.id == tournament.id)
        )
        db_obj = result.scalar_one()
        DBTournament.from_entity(tournament, db_obj)
        return db_obj.to_entity()

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

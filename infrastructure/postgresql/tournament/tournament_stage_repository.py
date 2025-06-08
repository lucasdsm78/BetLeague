from typing import List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.functions import func

from domain.tournament.model import TournamentStage
from domain.tournament.model.stage_type import StageType
from domain.tournament.model.tournament_player import TournamentPlayer
from domain.tournament.repository.tournament_stage_repository import TournamentStageRepository
from infrastructure.postgresql.tournament import DBTournament
from infrastructure.postgresql.tournament.db_tournament_player import DBTournamentPlayer
from infrastructure.postgresql.tournament.db_tournament_stage import DBTournamentStage


class TournamentStageRepositoryImpl(TournamentStageRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def add_stage(self, tournament_stage: TournamentStage):
        tournament_stage_db = DBTournamentStage.from_entity(tournament_stage)
        try:
            self.session.add(tournament_stage_db)
        except:
            raise

    async def update_stage(self, stage: TournamentStage):
        try:
            result = await self.session.execute(
                select(DBTournamentStage).where(DBTournamentStage.id == stage.id)
            )
            _tournament_stage = result.scalar_one()
            DBTournamentStage.from_entity(stage, _tournament_stage)
        except:
            raise

    async def begin(self):
        await self.session.begin()

    async def commit(self):
        await self.session.commit()

    async def rollback(self):
        await self.session.rollback()

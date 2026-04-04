from datetime import datetime
from typing import List, Optional
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from domain.tournament.model import TournamentStage
from domain.tournament.repository.tournament_stage_repository import TournamentStageRepository
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

    async def find_by_id(self, tournament_id: int, stage: str) -> Optional[TournamentStage]:
        try:
            result = await self.session.execute(
                select(DBTournamentStage)
                .where(
                    and_(
                        DBTournamentStage.tournament_id == tournament_id,
                        DBTournamentStage.type == stage
                    )
                )
            )
            tournament_stage_db = result.scalar_one_or_none()
            return tournament_stage_db.to_entity() if tournament_stage_db else None
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

    async def get_active_stage(self, tournament_id: int) -> Optional[TournamentStage]:
        try:
            result = await self.session.execute(
                select(DBTournamentStage)
                .where(
                    and_(
                        DBTournamentStage.tournament_id == tournament_id,
                        DBTournamentStage.is_active == True
                    )
                )
                .order_by(DBTournamentStage.start_date)  # Trier par date de début
                .limit(1)  # Ne prendre que la première étape active
            )
            stage_db = result.scalar_one_or_none()
            return stage_db.to_entity() if stage_db else None
        except:
            raise

    async def find_all_by_tournament(self, tournament_id: int) -> List[TournamentStage]:
        try:
            result = await self.session.execute(
                select(DBTournamentStage)
                .where(DBTournamentStage.tournament_id == tournament_id)
                .order_by(DBTournamentStage.start_date)
            )
            stages_db = result.scalars().all()
            return [stage.to_entity() for stage in stages_db]
        except:
            raise

    async def begin(self):
        await self.session.begin()

    async def commit(self):
        await self.session.commit()

    async def rollback(self):
        await self.session.rollback()

    async def find_due_active_stage_for_update(self, tournament_id: int, as_of: datetime) -> Optional[TournamentStage]:
        as_of_ms = int(as_of.timestamp() * 1000)
        result = await self.session.execute(
            select(DBTournamentStage)
            .where(
                DBTournamentStage.tournament_id == tournament_id,
                DBTournamentStage.is_active.is_(True),
                DBTournamentStage.is_completed.is_(False),
                DBTournamentStage.end_date <= as_of_ms,
            )
            .order_by(DBTournamentStage.start_date.asc(), DBTournamentStage.id.asc())
            .limit(1)
            .with_for_update(of=DBTournamentStage, skip_locked=True)
        )
        stage_db = result.scalar_one_or_none()
        return stage_db.to_entity() if stage_db else None

    async def find_next_stage(self, tournament_id: int, current_stage: TournamentStage) -> Optional[TournamentStage]:
        result = await self.session.execute(
            select(DBTournamentStage)
            .where(
                DBTournamentStage.tournament_id == tournament_id,
                DBTournamentStage.start_date > current_stage.start_date,
            )
            .order_by(DBTournamentStage.start_date.asc(), DBTournamentStage.id.asc())
            .limit(1)
        )
        stage_db = result.scalar_one_or_none()
        return stage_db.to_entity() if stage_db else None


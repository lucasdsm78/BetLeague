from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from domain.tournament.model.tournament_match import TournamentMatch
from domain.tournament.repository.tournament_match_repository import TournamentMatchRepository
from infrastructure.postgresql.tournament.db_tournament_match import DBTournamentMatch


class TournamentMatchRepositoryImpl(TournamentMatchRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def add_match(self, tournament_match: TournamentMatch):
        db_tournament_match = DBTournamentMatch.from_entity(tournament_match)
        try:
            self.session.add(db_tournament_match)
        except:
            raise

    async def find_matches_by_tournament_stages(self, tournament_id: int, stage: str):
        try:
            result = await self.session.execute(
                select(DBTournamentMatch)
                .where(
                    DBTournamentMatch.tournament_id == tournament_id,
                    DBTournamentMatch.type == stage
                )
            )
            matches_db = result.scalars().all()
            return [match.to_entity() for match in matches_db]
        except:
            raise

    async def find_matches_by_tournament_id(self, tournament_id: int):
        try:
            result = await self.session.execute(
                select(DBTournamentMatch)
                .where(
                    DBTournamentMatch.tournament_id == tournament_id
                )
            )
            matches_db = result.scalars().all()
            return [match.to_entity() for match in matches_db]
        except:
            raise

    async def update(self, match: TournamentMatch) -> Optional[TournamentMatch]:
        result = await self.session.execute(
            select(DBTournamentMatch).where(DBTournamentMatch.id == match.id)
        )
        db_match = result.scalar_one()
        DBTournamentMatch.from_entity(match, db_match)
        return db_match.to_entity()

    async def find_by_id(self, match_id: int) -> Optional[TournamentMatch]:
        result = await self.session.execute(
            select(DBTournamentMatch).where(DBTournamentMatch.id == match_id)
        )
        db_match = result.scalar_one_or_none()
        return db_match.to_entity() if db_match else None

    async def find_matches_by_stage_id(self, stage_id: int):
        result = await self.session.execute(
            select(DBTournamentMatch)
            .where(DBTournamentMatch.stage_id == stage_id)
            .order_by(DBTournamentMatch.id.asc())
        )
        matches_db = result.scalars().all()
        return [match.to_entity() for match in matches_db]


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

    async def get_matches_by_tournament_stages(self, tournament_id: int, stage: str):
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

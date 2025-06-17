from sqlalchemy.ext.asyncio import AsyncSession

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

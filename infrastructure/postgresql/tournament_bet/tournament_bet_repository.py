from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from domain.tournament_bet.model.tournament_bet import TournamentBet
from domain.tournament_bet.repository.tournament_bet_repository import TournamentBetRepository
from infrastructure.postgresql.tournament_bet.db_tournament_bet import DBTournamentBet


class TournamentBetRepositoryImpl(TournamentBetRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def add(self, bet: TournamentBet) -> Optional[TournamentBet]:
        db_obj = DBTournamentBet.from_entity(bet)
        self.session.add(db_obj)
        return db_obj.to_entity()

    async def find_by_player_match(self, player_id: int, match_id: int) -> Optional[TournamentBet]:
        result = await self.session.execute(
            select(DBTournamentBet).where(
                DBTournamentBet.player_id == player_id,
                DBTournamentBet.match_id == match_id
            )
        )
        bet_db = result.scalar_one_or_none()
        return bet_db.to_entity() if bet_db else None

    async def begin(self):
        await self.session.begin()

    async def commit(self):
        await self.session.commit()

    async def rollback(self):
        await self.session.rollback()

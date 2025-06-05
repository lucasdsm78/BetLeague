from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from domain.tournament.model.tournament import TournamentStage
from domain.tournament.model.tournament_player import TournamentPlayer
from domain.tournament.repository.tournament_players_repository import TournamentPlayersRepository
from infrastructure.postgresql.tournament.db_tournament_player import DBTournamentPlayer


class TournamentPlayersRepositoryImpl(TournamentPlayersRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def add_player(self, player: TournamentPlayer):
        db_player = DBTournamentPlayer.from_entity(player)
        self.session.add(db_player)

    async def get_player(self, tournament_id: int, user_id: int) -> Optional[TournamentPlayer]:
        result = await self.session.execute(
            select(DBTournamentPlayer).where(
                DBTournamentPlayer.tournament_id == tournament_id,
                DBTournamentPlayer.user_id == user_id,
            )
        )
        db_player = result.scalar_one_or_none()
        return db_player.to_entity() if db_player else None

    async def update(self, player: TournamentPlayer) -> Optional[TournamentPlayer]:
        result = await self.session.execute(
            select(DBTournamentPlayer).where(DBTournamentPlayer.id == player.id)
        )
        db_player = result.scalar_one()
        DBTournamentPlayer.from_entity(player, db_player)
        return db_player.to_entity()

    async def count_players(self, tournament_id: int) -> int:
        result = await self.session.execute(
            select(DBTournamentPlayer).where(DBTournamentPlayer.tournament_id == tournament_id)
        )
        return len(result.scalars().all())

    async def get_players_by_stage(self, tournament_id: int, stage: TournamentStage) -> List[TournamentPlayer]:
        result = await self.session.execute(
            select(DBTournamentPlayer).where(
                DBTournamentPlayer.tournament_id == tournament_id,
                DBTournamentPlayer.stage == stage.value,
            )
        )
        return [p.to_entity() for p in result.scalars().all()]

    async def begin(self):
        await self.session.begin()

    async def commit(self):
        await self.session.commit()

    async def rollback(self):
        await self.session.rollback()

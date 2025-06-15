from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.functions import func

from domain.tournament.model.stage_type import StageType
from domain.tournament.model.tournament_player import TournamentPlayer
from domain.tournament.repository.tournament_players_repository import TournamentPlayersRepository
from infrastructure.postgresql.tournament import DBTournament
from infrastructure.postgresql.tournament.db_tournament_player import DBTournamentPlayer


class TournamentPlayersRepositoryImpl(TournamentPlayersRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def add_player(self, player: TournamentPlayer):
        db_player = DBTournamentPlayer.from_entity(player)
        self.session.add(db_player)

    async def get_player(self, tournament_id: int, user_id: int) -> Optional[TournamentPlayer]:
        try:
            result = await self.session.execute(
                select(DBTournamentPlayer).where(
                    DBTournamentPlayer.tournament_id == tournament_id,
                    DBTournamentPlayer.user_id == user_id,
                    )
            )
            tournament_players_db = result.scalar_one()
            if tournament_players_db:
                return tournament_players_db.to_entity()
            return None
        except:
            raise

    async def update(self, player: TournamentPlayer) -> Optional[TournamentPlayer]:
        result = await self.session.execute(
            select(DBTournamentPlayer).where(DBTournamentPlayer.id == player.id)
        )
        db_player = result.scalar_one()
        DBTournamentPlayer.from_entity(player, db_player)
        return db_player.to_entity()

    async def count_players(self, tournament_id: int) -> int:
        try:
            query = select(func.count()).select_from(DBTournamentPlayer).where(
                DBTournamentPlayer.tournament_id == tournament_id
            )
            result = await self.session.execute(query)
            return result.scalar_one()
        except:
            raise

    async def get_players_by_stage(self, tournament_id: int, stage: StageType) -> List[TournamentPlayer]:
        result = await self.session.execute(
            select(DBTournamentPlayer)
            .join(DBTournament, DBTournamentPlayer.tournament_id == DBTournament.id)
            .where(DBTournamentPlayer.stage == stage.value)
        )

        tournaments_db = result.scalars().all()
        return [tournament_db.to_entity() for tournament_db in tournaments_db]

    async def begin(self):
        await self.session.begin()

    async def commit(self):
        await self.session.commit()

    async def rollback(self):
        await self.session.rollback()

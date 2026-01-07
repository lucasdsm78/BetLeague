from typing import List, Dict
from sqlalchemy import func, select
from sqlalchemy.exc import NoResultFound
from sqlalchemy.ext.asyncio import AsyncSession

from domain.league.exception.league_exception import LeagueParticipantNotFoundError
from domain.league.model.league_players import LeaguePlayers
from domain.league.repository.league_players_repository import LeaguePlayersRepository
from infrastructure.postgresql.league.db_league_players import DBLeaguePlayers
from infrastructure.postgresql.user.db_user import DBUser


class LeaguePlayersRepositoryImpl(LeaguePlayersRepository):

    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def join_league(self, league_players: LeaguePlayers):
        league_players_db = DBLeaguePlayers.from_entity(league_players)
        try:
            self.session.add(league_players_db)
        except:
            raise

    async def get_league_rank(self, league_id: int) -> List[Dict[str, any]]:
        try:
            query = (
                select(
                    DBLeaguePlayers.btl_from_tickets.label("nb_btl"),
                    DBLeaguePlayers.nb_win.label("nb_win"),
                    DBLeaguePlayers.nb_lose.label("nb_lose"),
                    DBUser.pseudo.label("pseudo"),
                    func.rank().over(
                        order_by=DBLeaguePlayers.btl_from_tickets.desc()
                    ).label("position")
                )
                .join(DBUser, DBLeaguePlayers.user_id == DBUser.id)
                .where(DBLeaguePlayers.league_id == league_id)
                .order_by(DBLeaguePlayers.btl_from_tickets.desc())
            )

            result = await self.session.execute(query)
            ranking_result = result.all()

            return [
                {
                    "nb_btl": row.nb_btl,
                    "nb_win": row.nb_win,
                    "nb_lose": row.nb_lose,
                    "pseudo": row.pseudo,
                    "position": row.position
                }
                for row in ranking_result
            ]
        except:
            raise

    async def unregister_league(self, league_players_id: int):
        try:
            query = select(DBLeaguePlayers).where(DBLeaguePlayers.id == league_players_id)
            result = await self.session.execute(query)
            league_player = result.scalar_one()
            await self.session.delete(league_player)
        except:
            raise

    async def count_players(self, league_id: int) -> int:
        try:
            query = select(func.count()).select_from(DBLeaguePlayers).where(
                DBLeaguePlayers.league_id == league_id
            )
            result = await self.session.execute(query)
            return result.scalar_one()
        except:
            raise

    async def find_participation(self, league_id: int, user_id: int) -> bool:
        try:
            query = select(DBLeaguePlayers).where(
                DBLeaguePlayers.league_id == league_id,
                DBLeaguePlayers.user_id == user_id
            )
            result = await self.session.execute(query)
            return result.scalar_one_or_none() is not None
        except:
            raise

    async def get_participation(self, league_id: int, user_id: int) -> LeaguePlayers:
        try:
            query = select(DBLeaguePlayers).where(
                DBLeaguePlayers.league_id == league_id,
                DBLeaguePlayers.user_id == user_id
            )
            result = await self.session.execute(query)
            league_players_db = result.scalar_one()
            return league_players_db.to_entity()
        except NoResultFound:
            raise LeagueParticipantNotFoundError
        except:
            raise

    async def get_balances_by_league_ids(self, user_id: int, league_ids: List[int]) -> Dict[int, float]:
        if not league_ids:
            return {}

        try:
            query = (
                select(DBLeaguePlayers.league_id, DBLeaguePlayers.nb_btl)
                .where(
                    DBLeaguePlayers.user_id == user_id,
                    DBLeaguePlayers.league_id.in_(league_ids)
                )
            )
            result = await self.session.execute(query)
            rows = result.all()
            return {int(league_id): float(nb_btl or 0) for league_id, nb_btl in rows}
        except:
            raise

    async def delete_player(self, league_player_id: int):
        try:
            query = select(DBLeaguePlayers).where(DBLeaguePlayers.id == league_player_id)
            result = await self.session.execute(query)
            league_player = result.scalar_one()
            await self.session.delete(league_player)
        except:
            raise

    async def update(self, league_player: LeaguePlayers):
        try:
            query = select(DBLeaguePlayers).where(DBLeaguePlayers.id == league_player.id)
            result = await self.session.execute(query)
            _league_player = result.scalar_one()
            league_player_db = DBLeaguePlayers.from_entity(league_player, _league_player)
        except:
            raise

    async def begin(self):
        await self.session.begin()

    async def commit(self):
        await self.session.commit()

    async def rollback(self):
        await self.session.rollback()

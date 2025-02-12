from typing import List, Dict
from sqlalchemy import func

from sqlalchemy.exc import NoResultFound
from sqlalchemy.orm.session import Session

from domain.league.exception.league_exception import LeagueParticipantNotFoundError
from domain.league.model.league_players import LeaguePlayers
from domain.league.repository.league_players_repository import LeaguePlayersRepository
from infrastructure.postgresql.league.db_league_players import DBLeaguePlayers
from infrastructure.postgresql.user.db_user import DBUser


class LeaguePlayersRepositoryImpl(LeaguePlayersRepository):

    def __init__(self, session: Session):
        self.session: Session = session

    def join_league(self, league_players: LeaguePlayers):
        league_players_db = DBLeaguePlayers.from_entity(league_players)
        try:
            self.session.add(league_players_db)
        except:
            raise

    def get_league_rank(self, league_id: int) -> List[Dict[str, any]]:
        try:
            ranking_query = (
                self.session.query(
                    DBLeaguePlayers.nb_btl.label("nb_btl"),
                    DBLeaguePlayers.nb_win.label("nb_win"),
                    DBLeaguePlayers.nb_lose.label("nb_lose"),
                    DBUser.pseudo.label("pseudo"),
                    func.rank()
                    .over(order_by=DBLeaguePlayers.nb_btl.desc())
                    .label("position")
                )
                .join(DBUser, DBLeaguePlayers.user_id == DBUser.id)
                .filter(DBLeaguePlayers.league_id == league_id)
                .order_by(DBLeaguePlayers.nb_btl.desc())
            )

            ranking_result = ranking_query.all()

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

        except Exception as e:
            raise e

    def unregister_league(self, league_players_id: int):
        try:
            self.session.query(DBLeaguePlayers).filter_by(id=league_players_id).delete()
        except:
            raise

    def count_players(self, league_id: int) -> int:
        try:
            count = self.session.query(DBLeaguePlayers).filter_by(
                league_id=league_id
            ).count()
        except Exception:
            raise

        return count

    def find_participation(self, league_id: int, user_id: int) -> bool:
        try:
            result = False
            league_players_db = self.session.query(DBLeaguePlayers).filter_by(
                league_id=league_id,
                user_id=user_id
            ).count()

            if league_players_db != 0:
                result = True
        except Exception:
            raise

        return result

    def get_participation(self, league_id: int, user_id: int) -> LeaguePlayers:
        try:
            league_players_db = self.session.query(DBLeaguePlayers).filter_by(
                league_id=league_id,
                user_id=user_id
            ).one()
        except NoResultFound:
            raise LeagueParticipantNotFoundError
        except Exception:
            raise

        return league_players_db.to_entity()

    def delete_player(self, league_player_id: int):
        try:
            self.session.query(DBLeaguePlayers).filter_by(id=league_player_id).delete()
        except:
            raise

    def begin(self):
        self.session.begin()

    def commit(self):
        self.session.commit()

    def rollback(self):
        self.session.rollback()

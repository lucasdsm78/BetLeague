from sqlalchemy.exc import NoResultFound
from sqlalchemy.orm.session import Session

from domain.league.exception.league_exception import LeagueParticipantNotFoundError
from domain.league.model.league_players import LeaguePlayers
from domain.league.repository.league_players_repository import LeaguePlayersRepository
from infrastructure.postgresql.league.db_league_players import DBLeaguePlayers


class LeaguePlayersRepositoryImpl(LeaguePlayersRepository):

    def __init__(self, session: Session):
        self.session: Session = session

    def join_league(self, league_players: LeaguePlayers):
        league_players_db = DBLeaguePlayers.from_entity(league_players)
        try:
            self.session.add(league_players_db)
        except:
            raise

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

    def begin(self):
        self.session.begin()

    def commit(self):
        self.session.commit()

    def rollback(self):
        self.session.rollback()

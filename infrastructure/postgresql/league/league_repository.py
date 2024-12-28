from typing import List, Optional

from sqlalchemy.exc import NoResultFound
from sqlalchemy.orm.session import Session

from domain.league.exception.league_exception import LeagueNotFoundError
from domain.league.model.league import League
from domain.league.repository.league_repository import LeagueRepository
from infrastructure.postgresql.league.db_league import DBLeague


class LeagueRepositoryImpl(LeagueRepository):

    def __init__(self, session: Session):
        self.session: Session = session

    def create(self, league: League):
        league_db = DBLeague.from_entity(league)
        try:
            self.session.add(league_db)
        except:
            raise

    def find_by_id(self, league_id: int) -> Optional[League]:
        try:
            league_db = self.session.query(DBLeague).filter_by(id=league_id).one()
        except NoResultFound:
            raise LeagueNotFoundError
        except Exception as e:
            raise
        return league_db.to_entity()

    def find_by_name(self, name: str) -> bool:
        try:
            league_db = self.session.query(DBLeague).filter_by(name=name).one_or_none()
            if league_db is None:
                return False
            return True
        except Exception as e:
            raise

    def update(self, league: League):
        try:
            _league = self.session.query(DBLeague).filter_by(id=league.id).one()
            league_db = DBLeague.from_entity(league, _league)
        except:
            raise

    def begin(self):
        self.session.begin()

    def commit(self):
        self.session.commit()

    def rollback(self):
        self.session.rollback()

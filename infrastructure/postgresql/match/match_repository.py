from datetime import datetime
from typing import List, Optional
from sqlalchemy import exists
from sqlalchemy.exc import NoResultFound
from sqlalchemy.orm.session import Session

from domain.match.exception.match_exception import MatchNotFoundError
from domain.match.model.match import Match
from domain.match.repository.match_repository import MatchRepository
from infrastructure.postgresql.match.db_match import DBMatch, unixtimestamp
from infrastructure.postgresql.ticket.db_match_choices import DBMatchChoices


class MatchRepositoryImpl(MatchRepository):

    def __init__(self, session: Session):
        self.session: Session = session

    def find_match(self, home_team: str, away_team: str, cote_home: float, cote_draw: float, cote_away: float) -> bool:
        try:
            match_db = self.session.query(DBMatch).filter_by(
                home_team=home_team,
                away_team=away_team,
                cote_home=cote_home,
                cote_draw=cote_draw,
                cote_away=cote_away
            ).one_or_none()
            if not match_db:
                return False
            return True

        except Exception as e:
            raise

    def find_matches(self) -> List[Match]:
        try:
            now = datetime.utcnow()
            match_dbs = (
                self.session.query(DBMatch)
                .filter(DBMatch.time > now)
                .all()
            )
        except:
            raise

        if len(match_dbs) == 0:
            return []

        return list(map(lambda match_db: match_db.to_entity(), match_dbs))

    def find_by_id(self, match_id: int) -> Optional[Match]:
        try:
            match_db = self.session.query(DBMatch).filter_by(id=match_id).one()
        except NoResultFound:
            raise MatchNotFoundError
        except Exception as e:
            raise
        return match_db.to_entity()

    def is_correct_score(self, choice: str) -> bool:
        try:
            result = False
            match_db = (
                self.session.query(DBMatch)
                .filter_by(winner=choice)
                ).count()

            if match_db != 0:
                result = True
        except Exception:
            raise

        return result

    def exists_match_started_for_ticket(self, ticket_id: int) -> bool:
        now = datetime.utcnow()
        query = self.session.query(
            exists().where(
                (DBMatchChoices.ticket_id == ticket_id) &
                (DBMatch.id == DBMatchChoices.match_id) &
                (DBMatch.time <= now)
            )
        )
        return self.session.scalar(query)

    def begin(self):
        self.session.begin()

    def commit(self):
        self.session.commit()

    def rollback(self):
        self.session.rollback()

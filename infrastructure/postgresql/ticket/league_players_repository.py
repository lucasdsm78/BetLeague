from sqlalchemy.orm.session import Session

from domain.ticket.model.match_choice import MatchChoice
from domain.ticket.repository.match_choice_repository import MatchChoiceRepository
from infrastructure.postgresql.ticket.db_match_choices import DBMatchChoices


class MatchChoicesRepositoryImpl(MatchChoiceRepository):

    def __init__(self, session: Session):
        self.session: Session = session

    def create(self, match_choice: MatchChoice) :
        match_choice_db = DBMatchChoices.from_entity(match_choice)
        try:
            self.session.add(match_choice_db)
        except:
            raise

    def begin(self):
        self.session.begin()

    def commit(self):
        self.session.commit()

    def rollback(self):
        self.session.rollback()

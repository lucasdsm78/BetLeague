from typing import List

from sqlalchemy.orm.session import Session

from domain.ticket.model.match_choice import MatchChoice
from domain.ticket.model.match_choice_status import MatchChoiceStatus
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

    def get_all_match_choices_pending(self) -> List[MatchChoice]:
        try:
            match_choices_db = (
                self.session.query(DBMatchChoices)
                .filter_by(status=MatchChoiceStatus.pending.value)
                .all()
            )
        except:
            raise

        if len(match_choices_db) == 0:
            return []

        return list(map(lambda match_choice_db: match_choice_db.to_entity(), match_choices_db))

    def update(self, match_choice: MatchChoice):
        try:
            _match_choice = self.session.query(DBMatchChoices).filter_by(id=match_choice.id).one()
            match_choice_db = DBMatchChoices.from_entity(match_choice, _match_choice)
        except:
            raise

    def begin(self):
        self.session.begin()

    def commit(self):
        self.session.commit()

    def rollback(self):
        self.session.rollback()

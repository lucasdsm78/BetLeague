from typing import Union, Optional

from sqlalchemy import Column, Integer, String, ForeignKey, BigInteger
from sqlalchemy.orm import relationship

from domain.ticket.model.match_choice import MatchChoice
from infrastructure.postgresql.database import Base


class DBMatchChoices(Base):
    __tablename__ = "match_choices"
    id: Union[int, Column] = Column(Integer, primary_key=True, autoincrement=True)
    match_id: Union[int, Column] = Column(Integer, ForeignKey('match.id'))
    match = relationship("DBMatch", back_populates='match_choices')
    ticket_id: Union[int, Column] = Column(Integer, ForeignKey('ticket.id'))
    ticket = relationship("DBTicket", back_populates='match_choices')
    choice: Union[Integer, Column] = Column(Integer)

    def to_entity(self) -> MatchChoice:
        return MatchChoice(
            id=self.id,
            match_id=self.match_id,
            ticket_id=self.ticket_id,
            choice=self.choice
        )

    @staticmethod
    def from_entity(match_choices: MatchChoice, db_match_choices:
    Optional["DBMatchChoices"] = None) -> "DBMatchChoices":
        match_choices_db_to_update = db_match_choices if db_match_choices \
                                                                       is not None else DBMatchChoices()
        match_choices_db_to_update.id = match_choices.id
        match_choices_db_to_update.match_id = match_choices.match_id
        match_choices_db_to_update.ticket_id = match_choices.ticket_id
        match_choices_db_to_update.choice = match_choices.choice
        return match_choices_db_to_update

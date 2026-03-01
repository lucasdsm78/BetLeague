from typing import Union, Optional

from sqlalchemy import Column, Integer, String, ForeignKey, BigInteger
from sqlalchemy.orm import relationship

from domain.ticket.model.match_choice import MatchChoice
from domain.ticket.model.match_choice_status import MatchChoiceStatus
from infrastructure.postgresql.database import Base


class DBMatchChoices(Base):
    __tablename__ = "match_choices"
    id: Union[int, Column] = Column(Integer, primary_key=True, autoincrement=True, index=True)
    match_id: Union[int, Column] = Column(Integer, ForeignKey('match.id'))
    match = relationship("DBMatch", back_populates='match_choices')
    ticket_id: Union[int, Column] = Column(Integer, ForeignKey('ticket.id'), index=True)
    ticket = relationship("DBTicket", back_populates='match_choices')
    choice: Union[str, Column] = Column(String, nullable=False)
    status: Union[str, Column] = Column(String, nullable=False)
    match_odd_id: Union[int, Column] = Column(Integer, ForeignKey('match_odds.id', ondelete="SET NULL"), nullable=True, index=True)

    def to_entity(self) -> MatchChoice:
            return MatchChoice(
                id=self.id,
                match_id=self.match_id,
                ticket_id=self.ticket_id,
                choice=self.choice,
                status=MatchChoiceStatus.from_str(self.status),
                match_odd_id=self.match_odd_id,
            )

    @staticmethod
    def from_entity(match_choices: MatchChoice, db_match_choices:
    Optional["DBMatchChoices"] = None) -> "DBMatchChoices":
        match_choices_db_to_update = db_match_choices if db_match_choices \
                                                                       is not None else DBMatchChoices()
        match_choices_db_to_update.id = match_choices.id
        match_choices_db_to_update.match_id = match_choices.match_id
        match_choices_db_to_update.ticket_id = match_choices.ticket_id
        match_choices_db_to_update.status = match_choices.status.value
        match_choices_db_to_update.choice = match_choices.choice
        match_choices_db_to_update.match_odd_id = match_choices.match_odd_id
        return match_choices_db_to_update

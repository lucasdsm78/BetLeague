from datetime import datetime
from typing import Union, Optional

from sqlalchemy import Column, Integer, String, Boolean, BigInteger, ForeignKey, Float
from sqlalchemy.orm import relationship

from domain.ticket.model.ticket import Ticket
from domain.ticket.model.ticket_status import TicketStatus
from domain.user.model.email import Email
from domain.user.model.user_summary import UserSummary
from infrastructure.postgresql.database import Base


def unixtimestamp() -> int:
    return int(datetime.now().timestamp() * 1000)


class DBTicket(Base):

    __tablename__ = "ticket"
    id: Union[Integer, Column] = Column(Integer, primary_key=True, autoincrement=True)
    uuid: Union[str, Column] = Column(String, nullable=False, unique=True)
    mise: Union[Integer, Column] = Column(BigInteger, nullable=False)
    gain: Union[Integer, Column] = Column(Float, nullable=False)
    user_id: Union[int, Column] = Column(Integer, ForeignKey('user.id'))
    user = relationship("DBUser", back_populates='tickets')
    league_id: Union[int, Column] = Column(Integer, ForeignKey('league.id'))
    league = relationship("DBLeague", back_populates='tickets')
    status: Union[str, Column] = Column(String, nullable=False)
    created_at: Union[BigInteger, Column] = Column(BigInteger, index=True, nullable=False)
    updated_at: Union[BigInteger, Column] = Column(BigInteger, index=True, nullable=False)
    match_choices = relationship("DBMatchChoices", back_populates="ticket")

    def to_entity(self) -> Ticket:
        return Ticket(
            id=self.id,
            league_id=self.league_id,
            uuid=self.uuid,
            mise=self.mise,
            gain=self.gain,
            user=UserSummary(id=self.user_id, email=Email(self.user.email), pseudo=self.user.pseudo),
            created_at=self.created_at,
            updated_at=self.updated_at,
            status=TicketStatus.from_str(self.status),
        )

    @staticmethod
    def from_entity(ticket: Ticket, db_ticket: Optional["DBTicket"] = None) -> "DBTicket":
        now = unixtimestamp()
        ticket_db_to_update = db_ticket if db_ticket is not None else DBTicket()
        ticket_db_to_update.id = ticket.id
        ticket_db_to_update.uuid = ticket.uuid
        ticket_db_to_update.mise = ticket.mise
        ticket_db_to_update.gain = ticket.gain
        ticket_db_to_update.league_id = ticket.league_id
        ticket_db_to_update.user_id = ticket.user.id
        ticket_db_to_update.status = ticket.status.value
        ticket_db_to_update.created_at = now
        ticket_db_to_update.updated_at = now
        return ticket_db_to_update

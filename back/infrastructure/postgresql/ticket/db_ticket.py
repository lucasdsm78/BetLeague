from datetime import datetime
from typing import Union, Optional

from sqlalchemy import Column, Integer, String, BigInteger, ForeignKey, Float, Index, UniqueConstraint
from sqlalchemy.orm import relationship

from domain.ticket.model.ticket import Ticket
from domain.ticket.model.ticket_status import TicketStatus
from domain.user.model.email import Email
from domain.user.model.user_summary import UserSummary
from infrastructure.postgresql.database import Base


def unixtimestamp() -> int:
    # Always use UTC to avoid timezone-dependent shifts
    return int(datetime.utcnow().timestamp() * 1000)


class DBTicket(Base):

    __tablename__ = "ticket"
    __table_args__ = (
        Index("ix_ticket_league_id", "league_id"),
        Index("ix_ticket_tournament_match_id", "tournament_match_id"),
        Index("ix_ticket_user_status_league_id_id", "user_id", "status", "league_id", "id"),
        Index("ix_ticket_user_tournament_match", "user_id", "tournament_match_id"),
        UniqueConstraint("user_id", "display_number", name="uq_ticket_user_display_number"),
    )

    id: Union[int, Column] = Column(Integer, primary_key=True, autoincrement=True)
    uuid: Union[str, Column] = Column(String, nullable=False, unique=True, index=True)
    display_number: Union[int, Column] = Column(Integer, nullable=False)
    mise: Union[int, Column] = Column(BigInteger, nullable=False)
    gain: Union[float, Column] = Column(Float, nullable=False)
    user_id: Union[int, Column] = Column(Integer, ForeignKey('user.id'))
    user = relationship("DBUser", back_populates='tickets')
    league_id: Union[int, Column] = Column(Integer, ForeignKey('league.id'), nullable=True)
    league = relationship("DBLeague", back_populates='tickets')
    tournament_match_id: Union[int, Column] = Column(Integer, ForeignKey('tournament_match.id'), nullable=True)
    tournament_match = relationship("DBTournamentMatch")
    status: Union[str, Column] = Column(String, nullable=False)
    created_at: Union[int, Column] = Column(BigInteger, index=True, nullable=False)
    updated_at: Union[int, Column] = Column(BigInteger, index=True, nullable=False)
    match_choices = relationship("DBMatchChoices", back_populates="ticket")

    def to_entity(self) -> Ticket:
        return Ticket(
            id=self.id,
            display_number=self.display_number,
            tournament_match_id=self.tournament_match_id,
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
        ticket_db_to_update.display_number = ticket.display_number
        ticket_db_to_update.mise = ticket.mise
        ticket_db_to_update.gain = ticket.gain
        ticket_db_to_update.tournament_match_id = ticket.tournament_match_id
        ticket_db_to_update.league_id = ticket.league_id
        ticket_db_to_update.user_id = ticket.user.id
        ticket_db_to_update.status = ticket.status.value
        # Preserve original creation time when updating
        ticket_db_to_update.created_at = ticket_db_to_update.created_at if db_ticket is not None else now
        ticket_db_to_update.updated_at = now
        return ticket_db_to_update

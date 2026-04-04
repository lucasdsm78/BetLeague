from datetime import datetime
from typing import Union, Optional

from sqlalchemy import Column, Integer, String, Boolean, BigInteger, ForeignKey, Float
from sqlalchemy import Index
from sqlalchemy.orm import relationship

from domain.league.model.league import League, LeagueStatus
from domain.user.model.email import Email
from domain.user.model.user_summary import UserSummary
from infrastructure.postgresql.database import Base


def unixtimestamp() -> int:
    # Always use UTC to avoid timezone-dependent shifts
    return int(datetime.utcnow().timestamp() * 1000)


class DBLeague(Base):

    __tablename__ = "league"
    __table_args__ = (
        Index('ix_league_is_started', 'is_started'),
        Index('ix_league_status_end_date', 'status', 'end_date'),
    )

    id: Union[int, Column] = Column(Integer, primary_key=True, autoincrement=True, index=True)
    uuid: Union[str, Column] = Column(String, nullable=False, unique=True, index=True)
    name: Union[str, Column] = Column(String, nullable=False, index=True)
    is_free: Union[bool, Column] = Column(Boolean, nullable=False)
    nb_players_remaining: Union[int, Column] = Column(Integer)
    is_private: Union[bool, Column] = Column(Boolean, nullable=False)
    nb_btl: Union[int, Column] = Column(Integer, nullable=True)
    is_started: Union[bool, Column] = Column(Boolean, nullable=False, default=False)
    status: Union[str, Column] = Column(String, nullable=False, default=LeagueStatus.OPEN.value)
    start_date: Union[int, Column] = Column(BigInteger, index=True, nullable=False)
    end_date: Union[int, Column] = Column(BigInteger, index=True, nullable=False)
    max_players: Union[int, Column] = Column(Integer, nullable=False)
    winner_id: Union[int, Column] = Column(Integer, ForeignKey('user.id'))
    closed_at: Union[int, Column] = Column(BigInteger, index=True, nullable=True)
    reward_paid_at: Union[int, Column] = Column(BigInteger, index=True, nullable=True)
    rewarded_amount: Union[float, Column] = Column(Float, nullable=True)
    winner = relationship("DBUser", foreign_keys=[winner_id])
    user_id: Union[int, Column] = Column(Integer, ForeignKey('user.id'))
    user = relationship("DBUser", foreign_keys=[user_id], back_populates="leagues")
    created_at: Union[int, Column] = Column(BigInteger, index=True, nullable=False)
    updated_at: Union[int, Column] = Column(BigInteger, index=True, nullable=False)
    league_players = relationship("DBLeaguePlayers", back_populates="league")
    tickets = relationship("DBTicket", back_populates="league")
    invitations = relationship("DBInvitation", back_populates="league")

    def to_entity(self) -> League:
        return League(
            id=self.id,
            uuid=self.uuid,
            is_free=self.is_free,
            nb_btl=self.nb_btl,
            winner_id=self.winner_id,
            is_started=self.is_started,
            status=self.status,
            closed_at=self.closed_at,
            reward_paid_at=self.reward_paid_at,
            rewarded_amount=self.rewarded_amount,
            is_private=self.is_private,
            max_players=self.max_players,
            name=self.name,
            start_date=self.start_date,
            user=UserSummary(id=self.user_id, email=Email(self.user.email), pseudo=self.user.pseudo),
            nb_players_remaining=self.nb_players_remaining,
            created_at=self.created_at,
            updated_at=self.updated_at,
            end_date=self.end_date,
        )

    @staticmethod
    def from_entity(league: League, db_league: Optional["DBLeague"] = None) -> "DBLeague":
        now = unixtimestamp()
        league_db_to_update = db_league if db_league is not None else DBLeague()
        league_db_to_update.id = league.id
        league_db_to_update.uuid = league.uuid
        league_db_to_update.is_free = league.is_free
        league_db_to_update.is_started = league.is_started
        league_db_to_update.status = league.status.value
        league_db_to_update.nb_btl = league.nb_btl
        league_db_to_update.winner_id = league.winner_id
        league_db_to_update.closed_at = league.closed_at
        league_db_to_update.reward_paid_at = league.reward_paid_at
        league_db_to_update.rewarded_amount = league.rewarded_amount
        league_db_to_update.is_private = league.is_private
        league_db_to_update.name = league.name
        league_db_to_update.nb_players_remaining = league.nb_players_remaining
        league_db_to_update.max_players = league.max_players
        league_db_to_update.start_date = league.start_date
        league_db_to_update.end_date = league.end_date
        league_db_to_update.user_id = league.user.id
        # Preserve original creation time when updating
        league_db_to_update.created_at = league_db_to_update.created_at if db_league is not None else now
        league_db_to_update.updated_at = now
        return league_db_to_update

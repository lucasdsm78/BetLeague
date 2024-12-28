from datetime import datetime
from typing import Union, Optional

from sqlalchemy import Column, Integer, String, Boolean, BigInteger, ForeignKey
from sqlalchemy.orm import relationship

from domain.league.model.league import League
from domain.user.model.email import Email
from domain.user.model.user_summary import UserSummary
from infrastructure.postgresql.database import Base


def unixtimestamp() -> int:
    return int(datetime.now().timestamp() * 1000)


class DBLeague(Base):

    __tablename__ = "league"
    id: Union[Integer, Column] = Column(Integer, primary_key=True, autoincrement=True)
    uuid: Union[str, Column] = Column(String, nullable=False, unique=True)
    name: Union[str, Column] = Column(String, nullable=False)
    is_free: Union[bool, Column] = Column(Boolean, nullable=False)
    is_private: Union[bool, Column] = Column(Boolean, nullable=False)
    is_started: Union[bool, Column] = Column(Boolean, nullable=False, default=False)
    start_date: Union[BigInteger, Column] = Column(BigInteger, index=True, nullable=False)
    end_date: Union[BigInteger, Column] = Column(BigInteger, index=True, nullable=False)
    max_players: Union[Integer, Column] = Column(Integer, nullable=False)
    user_id: Union[int, Column] = Column(Integer, ForeignKey('user.id'))
    user = relationship("DBUser", back_populates='leagues')
    created_at: Union[BigInteger, Column] = Column(BigInteger, index=True, nullable=False)
    updated_at: Union[BigInteger, Column] = Column(BigInteger, index=True, nullable=False)
    league_players = relationship("DBLeaguePlayers", back_populates="league")

    def to_entity(self) -> League:
        return League(
            id=self.id,
            uuid=self.uuid,
            is_free=self.is_free,
            is_started=self.is_started,
            is_private=self.is_private,
            max_players=self.max_players,
            name=self.name,
            start_date=self.start_date,
            user=UserSummary(id=self.user_id, email=Email(self.user.email)),
            end_date=self.end_date,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )

    @staticmethod
    def from_entity(league: League, db_league: Optional["DBLeague"] = None) -> "DBLeague":
        now = unixtimestamp()
        league_db_to_update = db_league if db_league is not None else DBLeague()
        league_db_to_update.id = league.id
        league_db_to_update.uuid = league.uuid
        league_db_to_update.is_free = league.is_free
        league_db_to_update.is_started = league.is_started
        league_db_to_update.is_private = league.is_private
        league_db_to_update.name = league.name
        league_db_to_update.max_players = league.max_players
        league_db_to_update.start_date = league.start_date
        league_db_to_update.end_date = league.end_date
        league_db_to_update.user_id = league.user.id
        league_db_to_update.created_at = now
        league_db_to_update.updated_at = now
        return league_db_to_update

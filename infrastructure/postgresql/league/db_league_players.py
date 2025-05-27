from datetime import datetime
from typing import Union, Optional

from sqlalchemy import Column, Integer, String, ForeignKey, BigInteger, Float, Index
from sqlalchemy.orm import relationship

from domain.league.model.league_players import LeaguePlayers
from infrastructure.postgresql.database import Base


def unixtimestamp() -> int:
    return int(datetime.now().timestamp() * 1000)


class DBLeaguePlayers(Base):
    __tablename__ = "leagues_players"
    id: Union[int, Column] = Column(Integer, primary_key=True, autoincrement=True)
    user_id: Union[int, Column] = Column(Integer, ForeignKey('user.id'))
    user = relationship("DBUser", back_populates='league_players')
    league_id: Union[int, Column] = Column(Integer, ForeignKey('league.id'))
    league = relationship("DBLeague", back_populates='league_players')
    nb_win: Union[int, Column] = Column(Integer, default=0)
    nb_lose: Union[int, Column] = Column(Integer, default=0)
    nb_btl: Union[float, Column] = Column(Float, default=100)
    created_at: Union[int, Column] = Column(BigInteger, index=True, nullable=False)
    updated_at: Union[int, Column] = Column(BigInteger, index=True, nullable=False)

    __table_args__ = (
        Index("idx_user_league_league_players", "user_id", "league_id"),
        Index(
            "idx_league_players_league_id",
            "league_id",
        ),
        Index(
            "idx_league_players_user_id",
            "user_id",
        ),
    )

    def to_entity(self) -> LeaguePlayers:
        return LeaguePlayers(
            id=self.id,
            user_id=self.user_id,
            league_id=self.league_id,
            nb_btl=self.nb_btl,
            nb_lose=self.nb_lose,
            nb_win=self.nb_win,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )

    @staticmethod
    def from_entity(league_players: LeaguePlayers, db_league_players:
    Optional["DBLeaguePlayers"] = None) -> "DBLeaguePlayers":
        now = unixtimestamp()
        league_players_db_to_update = db_league_players if db_league_players \
                                                                       is not None else DBLeaguePlayers()
        league_players_db_to_update.id = league_players.id
        league_players_db_to_update.user_id = league_players.user_id
        league_players_db_to_update.league_id = league_players.league_id
        league_players_db_to_update.nb_btl = league_players.nb_btl
        league_players_db_to_update.nb_win = league_players.nb_win
        league_players_db_to_update.nb_lose = league_players.nb_lose
        league_players_db_to_update.created_at = now
        league_players_db_to_update.updated_at = now
        return league_players_db_to_update

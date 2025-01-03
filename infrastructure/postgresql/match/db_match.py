from datetime import datetime
from typing import Union, Optional

from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.orm import relationship

from domain.match.model.match import Match
from infrastructure.postgresql.database import Base


def unixtimestamp() -> int:
    return int(datetime.now().timestamp())


class DBMatch(Base):

    __tablename__ = "match"
    id: Union[int, Column] = Column(Integer, primary_key=True, autoincrement=True)
    uuid: Union[str, Column] = Column(String, nullable=False, unique=True)
    home_team: Union[str, Column] = Column(String, nullable=False)
    away_team: Union[str, Column] = Column(String, nullable=False)
    cote_home: Union[float, Column] = Column(Float, nullable=False)
    cote_draw: Union[float, Column] = Column(Float, nullable=False)
    cote_away: Union[float, Column] = Column(Float, nullable=False)
    time: Union[datetime, Column] = Column(DateTime, nullable=False)
    created_at: Union[int, Column] = Column(Integer, index=True, nullable=False)
    winner: Union[str, Column] = Column(String, nullable=True)
    updated_at: Union[int, Column] = Column(Integer, index=True, nullable=False)
    match_choices = relationship("DBMatchChoices", back_populates="match")

    def to_entity(self) -> Match:
        return Match(
            id=self.id,
            uuid=self.uuid,
            home_team=self.home_team,
            away_team=self.away_team,
            cote_home=self.cote_home,
            cote_draw=self.cote_draw,
            cote_away=self.cote_away,
            winner=self.winner,
            time=self.time,
            created_at=self.created_at,
            updated_at=self.updated_at
        )

    @staticmethod
    def from_entity(match: Match, db_match: Optional["DBMatch"] = None) -> "DBMatch":
        now = unixtimestamp()
        match_db_to_update = db_match if db_match is not None else DBMatch()
        match_db_to_update.id = match.id
        match_db_to_update.uuid = match.uuid
        match_db_to_update.home_team = match.home_team
        match_db_to_update.away_team = match.away_team
        match_db_to_update.winner = match.winner
        match_db_to_update.cote_home = match.cote_home
        match_db_to_update.cote_draw = match.cote_draw
        match_db_to_update.cote_away = match.cote_away
        match_db_to_update.time = match.time
        match_db_to_update.created_at = now
        match_db_to_update.updated_at = now
        return match_db_to_update

from datetime import datetime
from typing import Union, Optional

from sqlalchemy import Column, Integer, String, DateTime, BigInteger, Index
from sqlalchemy.orm import relationship

from domain.match.model.match import Match
from domain.match.model.sport import Sport
from domain.match.model.match_status import MatchStatus
from infrastructure.postgresql.database import Base


def unixtimestamp() -> int:
    # Always use UTC and milliseconds for consistency
    return int(datetime.utcnow().timestamp() * 1000)


class DBMatch(Base):

    __tablename__ = "match"

    id: Union[int, Column] = Column(Integer, primary_key=True, autoincrement=True)
    uuid: Union[str, Column] = Column(String, nullable=False, unique=True)
    home_team: Union[str, Column] = Column(String, nullable=False)
    away_team: Union[str, Column] = Column(String, nullable=False)
    time: Union[datetime, Column] = Column(DateTime, nullable=False)
    # Store timestamps as BigInteger (ms)
    created_at: Union[int, Column] = Column(BigInteger, index=True, nullable=False)
    winner: Union[str, Column] = Column(String, nullable=True)
    updated_at: Union[int, Column] = Column(BigInteger, index=True, nullable=False)

    sport: Union[str, Column] = Column(String, nullable=False, server_default="football")
    league_name: Union[str, Column] = Column(String, nullable=True)
    league_id: Union[int, Column] = Column(Integer, nullable=True)
    logo_home: Union[str, Column] = Column(String, nullable=True)
    logo_away: Union[str, Column] = Column(String, nullable=True)
    score_home: Union[int, Column] = Column(Integer, nullable=True)
    score_away: Union[int, Column] = Column(Integer, nullable=True)
    status: Union[str, Column] = Column(String, nullable=False, server_default="NS")
    api_fixture_id: Union[int, Column] = Column(Integer, nullable=True, unique=True, index=True)
    season: Union[int, Column] = Column(Integer, nullable=True)

    match_choices = relationship("DBMatchChoices", back_populates="match")

    __table_args__ = (
        Index('ix_match_time', 'time'),
        Index('ix_match_sport_time', 'sport', 'time'),
        Index('ix_match_status', 'status'),
    )

    def to_entity(self) -> Match:
        return Match(
            id=self.id,
            uuid=self.uuid,
            home_team=self.home_team,
            away_team=self.away_team,
            winner=self.winner,
            time=self.time,
            created_at=self.created_at,
            updated_at=self.updated_at,
            sport=Sport(self.sport) if self.sport else Sport.FOOTBALL,
            league_name=self.league_name,
            league_id=self.league_id,
            logo_home=self.logo_home,
            logo_away=self.logo_away,
            score_home=self.score_home,
            score_away=self.score_away,
            status=MatchStatus(self.status) if self.status else MatchStatus.NOT_STARTED,
            api_fixture_id=self.api_fixture_id,
            season=self.season,
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
        match_db_to_update.time = match.time
        match_db_to_update.sport = match.sport.value if hasattr(match.sport, 'value') else str(match.sport)
        match_db_to_update.league_name = match.league_name
        match_db_to_update.league_id = match.league_id
        match_db_to_update.logo_home = match.logo_home
        match_db_to_update.logo_away = match.logo_away
        match_db_to_update.score_home = match.score_home
        match_db_to_update.score_away = match.score_away
        match_db_to_update.status = match.status.value if hasattr(match.status, 'value') else str(match.status)
        match_db_to_update.api_fixture_id = match.api_fixture_id
        match_db_to_update.season = match.season
        # Preserve original creation time when updating
        match_db_to_update.created_at = match_db_to_update.created_at if db_match is not None else now
        match_db_to_update.updated_at = now
        return match_db_to_update

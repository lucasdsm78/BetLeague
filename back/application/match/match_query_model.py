from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from domain.match.model.match import Match


class MatchReadModel(BaseModel):

    id: int
    uuid: str
    home_team: str
    away_team: str
    cote_home: float
    cote_draw: float
    cote_away: float
    time: datetime
    created_at: int
    updated_at: int
    sport: str = "football"
    league_name: Optional[str] = None
    logo_home: Optional[str] = None
    logo_away: Optional[str] = None
    score_home: Optional[int] = None
    score_away: Optional[int] = None
    status: str = "NS"
    winner: Optional[str] = None

    class Config:
        arbitrary_types_allowed = True

    @staticmethod
    def from_entity(match: Match) -> "MatchReadModel":
        return MatchReadModel(
            id=match.id,
            uuid=match.uuid,
            home_team=match.home_team,
            away_team=match.away_team,
            cote_home=match.cote_home,
            cote_draw=match.cote_draw,
            cote_away=match.cote_away,
            time=match.time,
            created_at=match.created_at,
            updated_at=match.updated_at,
            sport=match.sport.value if hasattr(match.sport, 'value') else str(match.sport),
            league_name=match.league_name,
            logo_home=match.logo_home,
            logo_away=match.logo_away,
            score_home=match.score_home,
            score_away=match.score_away,
            status=match.status.value if hasattr(match.status, 'value') else str(match.status),
            winner=match.winner,
        )


class MatchesListResponse(BaseModel):
    matches: List[MatchReadModel] = Field(default_factory=list)
    page: int
    page_size: int
    total: int
    total_pages: int

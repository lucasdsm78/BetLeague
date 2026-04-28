from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from domain.match.model.match import Match
from domain.match.model.match_odd import MatchOdd


class MatchOddReadModel(BaseModel):
    id: int
    bet_type: str
    bet_name: str
    value: str
    odd: float
    result: Optional[str] = None

    @staticmethod
    def from_entity(odd: MatchOdd) -> "MatchOddReadModel":
        return MatchOddReadModel(
            id=odd.id,
            bet_type=odd.bet_type.value if hasattr(odd.bet_type, 'value') else str(odd.bet_type),
            bet_name=odd.bet_name,
            value=odd.value,
            odd=odd.odd,
            result=odd.result,
        )


class MatchReadModel(BaseModel):

    id: int
    uuid: str
    home_team: str
    away_team: str
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
    odds: List[MatchOddReadModel] = Field(default_factory=list)

    class Config:
        arbitrary_types_allowed = True

    @staticmethod
    def from_entity(match: Match, odds: Optional[List[MatchOdd]] = None) -> "MatchReadModel":
        return MatchReadModel(
            id=match.id,
            uuid=match.uuid,
            home_team=match.home_team,
            away_team=match.away_team,
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
            odds=[MatchOddReadModel.from_entity(o) for o in odds] if odds else [],
        )


class MatchesListResponse(BaseModel):
    matches: List[MatchReadModel] = Field(default_factory=list)
    page: int
    page_size: int
    total: int
    total_pages: int

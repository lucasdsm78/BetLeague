from typing import Optional

from pydantic import BaseModel
from datetime import datetime

class MatchSummary(BaseModel):

    id: int
    home_team: str
    away_team: str
    time: datetime
    winner: Optional[str]
    sport: str = "football"
    score_home: Optional[int] = None
    score_away: Optional[int] = None
    status: str = "NS"

    class Config:
        arbitrary_types_allowed = True

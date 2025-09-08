from typing import Optional

from pydantic import BaseModel
from datetime import datetime

class MatchSummary(BaseModel):

    id: int
    home_team: str
    away_team: str
    time: datetime
    winner: Optional[str]

    class Config:
        arbitrary_types_allowed = True

from pydantic import BaseModel
from application.match.match_summary import MatchSummary
from application.match.match_odd_summary import MatchOddSummary
from typing import Optional

class MatchChoiceSummary(BaseModel):

    id: int
    match_summary: MatchSummary
    choice: str
    status: str
    match_odd_summary: Optional[MatchOddSummary] = None

    class Config:
        arbitrary_types_allowed = True

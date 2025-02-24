from pydantic import BaseModel
from application.match.match_summary import MatchSummary

class MatchChoiceSummary(BaseModel):

    id: int
    match_summary: MatchSummary
    choice: str
    status: str

    class Config:
        arbitrary_types_allowed = True

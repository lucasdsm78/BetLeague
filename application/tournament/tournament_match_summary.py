from pydantic import BaseModel

class TournamentMatchSummary(BaseModel):

    tournament_match_id: int
    tournament_id: int
    stage_id: int
    type: str

    class Config:
        arbitrary_types_allowed = True

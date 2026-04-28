from pydantic import BaseModel

class TournamentMatchSummary(BaseModel):

    tournament_match_id: int
    tournament_id: int
    name: str | None = None
    stage_id: int
    type: str

    class Config:
        arbitrary_types_allowed = True

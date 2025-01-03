from datetime import datetime

from pydantic import BaseModel

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
            updated_at=match.updated_at
        )

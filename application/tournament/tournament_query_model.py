from typing import Optional, List

from pydantic import BaseModel

from domain.tournament.model import TournamentStage, StageType
from domain.tournament.model.tournament import Tournament

class TournamentReadModel(BaseModel):
    id: int
    uuid: str
    name: str
    is_private: bool
    max_players: int

    class Config:
        arbitrary_types_allowed = True

    @staticmethod
    def from_entity(tournament: Tournament) -> "TournamentReadModel":
        return TournamentReadModel(
            id=tournament.id,
            uuid=tournament.uuid,
            name=tournament.name,
            is_private=tournament.is_private,
            max_players=tournament.max_players,
        )

class TournamentStageReadModel(BaseModel):
    id: int
    tournament_id: int
    type: StageType
    user_id: int
    is_active: bool
    is_completed: bool
    created_at: Optional[int] = None
    start_date: Optional[int] = None
    end_date: Optional[int] = None

    class Config:
        arbitrary_types_allowed = True

    @classmethod
    def from_entity(cls, stage: TournamentStage) -> 'TournamentStageReadModel':
        return cls(
            id=stage.id,
            tournament_id=stage.tournament_id,
            user_id=stage.user_id,
            type=stage.type,
            created_at=stage.created_at,
            start_date=stage.start_date,
            end_date=stage.end_date,
            is_active=stage.is_active,
            is_completed=stage.is_completed
        )

class TournamentStagesResponse(BaseModel):
    stages: List[TournamentStageReadModel] = []

from typing import Optional, List

from pydantic import BaseModel

from application.user.user_query_model import UserSummaryReadModel
from domain.tournament.model import TournamentStage, StageType
from domain.tournament.model.tournament import Tournament
from domain.user.model.user_summary import UserSummary


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
    type: str
    user_summary: UserSummaryReadModel
    is_active: bool
    is_completed: bool
    created_at: Optional[int] = None
    start_date: Optional[int] = None
    end_date: Optional[int] = None

    class Config:
        arbitrary_types_allowed = True

class TournamentStagesResponse(BaseModel):
    stages: List[TournamentStageReadModel] = []


class TournamentMatchReadModel(BaseModel):
    id: int
    tournament_id: int
    stage: str
    player1_summary: UserSummaryReadModel
    player2_summary: UserSummaryReadModel
    start_date: Optional[int] = None
    winner_id: Optional[int] = None
    loser_id: Optional[int] = None
    end_date: Optional[int] = None

    class Config:
        arbitrary_types_allowed = True


class TournamentMatchesResponse(BaseModel):
    matches: List[TournamentMatchReadModel] = []


class TournamentsRegisteredResponse(BaseModel):
    tournaments: List[TournamentReadModel]
    total_count: int
    page: int
    page_size: int


class TournamentAvailablePublicReadModel(BaseModel):
    id: int
    uuid: str
    name: str
    is_private: bool
    max_players: int
    current_players: int
    start_date: int
    end_date: int

    @staticmethod
    def from_entity(tournament: Tournament) -> "TournamentAvailablePublicReadModel":
        return TournamentAvailablePublicReadModel(
            id=tournament.id,
            uuid=tournament.uuid,
            name=tournament.name,
            is_private=tournament.is_private,
            max_players=tournament.max_players,
            current_players=tournament.current_players,
            start_date=tournament.start_date,
            end_date=tournament.end_date
        )

class TournamentsAvailablePublicResponse(BaseModel):
    tournaments: List[TournamentAvailablePublicReadModel]
    total_count: int
    page: int
    page_size: int

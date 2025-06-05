from pydantic import BaseModel
from domain.tournament.model.tournament import Tournament

class TournamentReadModel(BaseModel):
    id: int
    uuid: str
    name: str
    is_private: bool
    max_players: int
    stage: str

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
            stage=tournament.stage.value,
        )

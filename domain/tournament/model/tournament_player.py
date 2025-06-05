from typing import Optional

from domain.tournament.model.tournament import TournamentStage

class TournamentPlayer:
    def __init__(
        self,
        user_id: int,
        tournament_id: int,
        nb_btl: float,
        stage: TournamentStage,
        id: Optional[int] = None,
        created_at: Optional[int] = None,
        updated_at: Optional[int] = None,
    ):
        self.id = id
        self.user_id = user_id
        self.tournament_id = tournament_id
        self.nb_btl = nb_btl
        self.stage = stage
        self.created_at = created_at
        self.updated_at = updated_at

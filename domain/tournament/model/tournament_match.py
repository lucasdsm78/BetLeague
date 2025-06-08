from typing import Optional

from domain.tournament.model.stage_type import StageType

class TournamentMatch:
    def __init__(
            self,
            stage_id: int,
            tournament_id: int,
            type: StageType,
            id: Optional[int] = None,
            player1_id: Optional[int] = None,
            player2_id: Optional[int] = None,
            winner_id: Optional[int] = None,
            loser_id: Optional[int] = None,
            created_at: Optional[int] = None,
            updated_at: Optional[int] = None
    ):
        self.id = id
        self.stage_id = stage_id
        self.tournament_id = tournament_id
        self.type = type
        self.player1_id = player1_id
        self.player2_id = player2_id
        self.winner_id = winner_id
        self.loser_id = loser_id
        self.created_at = created_at
        self.updated_at = updated_at

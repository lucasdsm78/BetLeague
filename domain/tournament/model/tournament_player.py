from typing import Optional

from domain.tournament.model.stage_type import StageType

class TournamentPlayer:
    def __init__(
        self,
        user_id: int,
        tournament_id: int,
        nb_btl: float,
        id: Optional[int] = None,
        is_eliminated: bool = False,
        created_at: Optional[int] = None,
        current_stage: Optional[StageType] = None,
        updated_at: Optional[int] = None
    ):
        self.id = id
        self.user_id = user_id
        self.tournament_id = tournament_id
        self.nb_btl = nb_btl
        self.created_at = created_at
        self.updated_at = updated_at
        self.is_eliminated = is_eliminated
        self.current_stage = current_stage

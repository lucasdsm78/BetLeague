from typing import Optional

from domain.tournament.model.stage_type import StageType


class TournamentStage:
    def __init__(
            self,
            user_id: int,
            tournament_id: int,
            type: StageType,
            id: Optional[int] = None,
            created_at: Optional[int] = None,
            start_date: Optional[int] = None,
            end_date: Optional[int] = None,
            is_active: bool = False,
            is_completed: bool = False
    ):
        self.id = id
        self.user_id = user_id
        self.tournament_id = tournament_id
        self.type = type
        self.created_at = created_at
        self.start_date = start_date
        self.end_date = end_date
        self.is_active = is_active
        self.is_completed = is_completed

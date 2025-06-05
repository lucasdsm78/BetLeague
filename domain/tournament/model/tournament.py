from enum import Enum
from typing import Optional

from domain.user.model.user_summary import UserSummary

class TournamentStage(str, Enum):
    eighth_final = "EIGHTH_FINAL"
    quarter_final = "QUARTER_FINAL"
    semi_final = "SEMI_FINAL"
    final = "FINAL"
    finished = "FINISHED"

class Tournament:
    def __init__(
        self,
        uuid: str,
        name: str,
        is_private: bool,
        max_players: int,
        start_date: int,
        end_date: int,
        user: UserSummary,
        stage: TournamentStage = TournamentStage.eighth_final,
        id: Optional[int] = None,
        winner_id: Optional[int] = None,
        created_at: Optional[int] = None,
        updated_at: Optional[int] = None,
    ):
        self.id = id
        self.uuid = uuid
        self.name = name
        self.is_private = is_private
        self.max_players = max_players
        self.start_date = start_date
        self.end_date = end_date
        self.stage = stage
        self.user = user
        self.winner_id = winner_id
        self.created_at = created_at
        self.updated_at = updated_at

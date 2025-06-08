from typing import Optional, List

from domain.tournament.model.tournament_status import TournamentStatus

from domain.user.model.user_summary import UserSummary

class Tournament:
    def __init__(
        self,
        uuid: str,
        name: str,
        is_private: bool,
        user: UserSummary,
        status: TournamentStatus = TournamentStatus.PENDING,
        max_players: int = 16,
        min_players: int = 3,
        current_players: int = 0,
        entry_fee: float = 0.0,
        prize_pool: float = 0.0,
        id: Optional[int] = None,
        winner_id: Optional[int] = None,
        created_at: Optional[int] = None,
        start_date: Optional[int] = None,
        end_date: Optional[int] = None,
    ):
        self.id = id
        self.uuid = uuid
        self.name = name
        self.status = status
        self.max_players = max_players
        self.min_players = min_players
        self.current_players = current_players
        self.entry_fee = entry_fee
        self.prize_pool = prize_pool
        self.is_private = is_private
        self.start_date = start_date
        self.end_date = end_date
        self.user = user
        self.winner_id = winner_id
        self.created_at = created_at

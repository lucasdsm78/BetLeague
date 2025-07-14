from typing import Optional

from domain.tournament_bet.model.tournament_bet_status import TournamentBetStatus


class TournamentBet:
    def __init__(
        self,
        player_id: int,
        match_id: int,
        amount: float,
        choice: str,
        status: TournamentBetStatus = TournamentBetStatus.PENDING,
        id: Optional[int] = None,
        created_at: Optional[int] = None,
        updated_at: Optional[int] = None,
    ):
        self.id = id
        self.player_id = player_id
        self.match_id = match_id
        self.amount = amount
        self.choice = choice
        self.status = status
        self.created_at = created_at
        self.updated_at = updated_at

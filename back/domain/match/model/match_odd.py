from typing import Optional

from domain.match.model.bet_type import BetType


class MatchOdd:

    def __init__(
        self,
        match_id: int,
        bet_type: BetType,
        bet_name: str,
        value: str,
        odd: float,
        id: Optional[int] = None,
        result: Optional[str] = None,
    ):
        self.id = id
        self.match_id = match_id
        self.bet_type = bet_type
        self.bet_name = bet_name
        self.value = value
        self.odd = odd
        self.result = result

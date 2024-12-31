from typing import Optional, List

from domain.ticket.model.match_choice import MatchChoice
from domain.user.model.user_summary import UserSummary


class Ticket:
    def __init__(
            self,
            mise: int,
            league_id: int,
            uuid: str,
            user: UserSummary,
            id: Optional[int] = None,
            created_at: Optional[int] = None,
            updated_at: Optional[int] = None
    ):
        self.id: Optional[int] = id
        self.uuid: str = uuid
        self.league_id: int = league_id
        self.mise: int = mise
        self.user: UserSummary = user
        self.created_at: Optional[int] = created_at
        self.updated_at: Optional[int] = updated_at

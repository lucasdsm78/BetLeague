from typing import Optional

from domain.ticket.model.match_choice_status import MatchChoiceStatus


class MatchChoice:

    def __init__(
            self,
            match_id: int,
            ticket_id: int,
            choice: str,
            status: MatchChoiceStatus,
            id: Optional[int] = None
    ):
        self.id: Optional[int] = id
        self.match_id: int = match_id
        self.ticket_id: int = ticket_id
        self.choice: str = choice
        self.status: MatchChoiceStatus = status

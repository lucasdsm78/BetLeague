from typing import Optional


class MatchChoice:

    def __init__(
            self,
            match_id: int,
            ticket_id: int,
            choice: int,
            id: Optional[int] = None
    ):
        self.id: Optional[int] = id
        self.match_id: int = match_id
        self.ticket_id: int = ticket_id
        self.choice: int = choice

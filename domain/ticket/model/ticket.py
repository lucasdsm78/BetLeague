from typing import Optional, List

from domain.ticket.model.match_choice import MatchChoice
from domain.ticket.model.ticket_status import TicketStatus
from domain.user.model.user_summary import UserSummary


class Ticket:
    def __init__(
            self,
            mise: int,
            uuid: str,
            gain: float,
            user: UserSummary,
            status: TicketStatus,
            id: Optional[int] = None,
            league_id: Optional[int] = None,
            tournament_match_id: Optional[int] = None,
            created_at: Optional[int] = None,
            updated_at: Optional[int] = None
    ):
        self.id: Optional[int] = id
        self.uuid: str = uuid
        self.gain: float = gain
        self.status: TicketStatus = status
        self.league_id: Optional[int] = league_id
        self.tournament_match_id: Optional[int] = tournament_match_id
        self.mise: int = mise
        self.user: UserSummary = user
        self.created_at: Optional[int] = created_at
        self.updated_at: Optional[int] = updated_at

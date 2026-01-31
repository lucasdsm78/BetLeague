from typing import Optional

from domain.invitation.model.invitation_status import InvitationStatus
from domain.user.model.user_summary import UserSummary


class Invitation:
    def __init__(
            self,
            user_id: int,
            user_sender_id: int,
            league_id: Optional[int],
            tournament_id: Optional[int],
            status: InvitationStatus,
            id: Optional[int] = None,
            created_at: Optional[int] = None,
            updated_at: Optional[int] = None
    ):
        self.user_id: int = user_id
        self.user_sender: int = user_sender_id
        self.league_id: Optional[int] = league_id
        self.tournament_id: Optional[int] = tournament_id
        self.status: InvitationStatus = status
        self.id: Optional[int] = id
        self.created_at: Optional[int] = created_at
        self.updated_at: Optional[int] = updated_at

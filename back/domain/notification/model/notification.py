from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Any, Mapping, Optional


class NotificationType(StrEnum):
    LEAGUE_INVITATION = "league_invitation"
    LEAGUE_INVITATION_ACCEPTED = "league_invitation_accepted"
    BET_WON = "bet_won"
    BET_LOST = "bet_lost"
    MATCH_RESULT = "match_result"
    LEAGUE_STARTED = "league_started"
    LEAGUE_ENDED = "league_ended"
    SYSTEM_ANNOUNCEMENT = "system_announcement"
    ACCOUNT_UPDATE = "account_update"
    TICKET_CREATED = "ticket_created"
    GENERIC = "generic"


@dataclass(frozen=True, slots=True)
class Notification:
    id: Optional[int]
    user_id: int
    type: NotificationType
    title: str
    message: str
    data: Mapping[str, Any]
    created_at: int
    read_at: Optional[int]

    def is_read(self) -> bool:
        return self.read_at is not None


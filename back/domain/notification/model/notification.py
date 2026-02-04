from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Any, Mapping, Optional


class NotificationType(StrEnum):
    GENERIC = "GENERIC"
    LEAGUE_INVITATION_ACCEPTED = "LEAGUE_INVITATION_ACCEPTED"
    LEAGUE_INVITATION_RECEIVED = "LEAGUE_INVITATION_RECEIVED"
    TICKET_CREATED = "TICKET_CREATED"


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


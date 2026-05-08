from __future__ import annotations

import time
from dataclasses import dataclass, field

from domain.utils.domain_event import DomainEvent


@dataclass(frozen=True, slots=True)
class TicketResolvedEvent(DomainEvent):
    ticket_id: int
    user_id: int
    league_id: int | None
    is_win: bool
    gain: float
    event_name: str = field(default="ticket.resolved", init=False)
    aggregate_type: str = field(default="ticket", init=False)
    aggregate_id: int = field(init=False)
    created_at: int = field(default_factory=lambda: int(time.time() * 1000), init=False)

    def __post_init__(self) -> None:
        object.__setattr__(self, "aggregate_id", self.ticket_id)

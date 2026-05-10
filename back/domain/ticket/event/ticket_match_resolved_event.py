from __future__ import annotations

import time
from dataclasses import dataclass, field

from domain.utils.domain_event import DomainEvent


@dataclass(frozen=True, slots=True)
class TicketMatchResolvedEvent(DomainEvent):
    ticket_ids: tuple[int, ...]
    match_id: int
    event_name: str = field(default="ticket.match.resolved", init=False)
    aggregate_type: str = field(default="ticket", init=False)
    aggregate_id: int = field(default=0, init=False)
    created_at: int = field(default_factory=lambda: int(time.time() * 1000), init=False)


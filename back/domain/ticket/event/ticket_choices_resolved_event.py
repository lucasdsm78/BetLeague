from __future__ import annotations

from dataclasses import dataclass, field
import time

from domain.utils.domain_event import DomainEvent


@dataclass(frozen=True, slots=True)
class TicketChoicesResolvedEvent(DomainEvent):
    ticket_id: int
    match_id: int
    event_name: str = field(default="ticket.choices.resolved", init=False)
    aggregate_type: str = field(default="ticket", init=False)
    aggregate_id: int = field(init=False)
    created_at: int = field(default_factory=lambda: int(time.time() * 1000), init=False)

    def __post_init__(self):
        object.__setattr__(self, 'aggregate_id', self.ticket_id)

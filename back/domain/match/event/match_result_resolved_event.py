from __future__ import annotations

from dataclasses import dataclass, field
import time

from domain.utils.domain_event import DomainEvent


@dataclass(frozen=True, slots=True)
class MatchResultResolvedEvent(DomainEvent):
    match_id: int
    event_name: str = field(default="match.result.resolved", init=False)
    aggregate_type: str = field(default="match", init=False)
    aggregate_id: int = field(init=False)
    created_at: int = field(default_factory=lambda: int(time.time() * 1000), init=False)

    def __post_init__(self):
        object.__setattr__(self, 'aggregate_id', self.match_id)

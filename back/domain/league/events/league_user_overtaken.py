from __future__ import annotations

import time
from dataclasses import dataclass, field

from domain.utils.domain_event import DomainEvent


@dataclass(frozen=True, slots=True)
class LeagueUserOvertaken(DomainEvent):
    league_id: int
    league_name: str
    overtaken_user_id: int
    overtaken_by_user_id: int
    overtaken_by_pseudo: str
    previous_position: int
    new_position: int
    event_name: str = field(default="league.user.overtaken", init=False)
    aggregate_type: str = field(default="league", init=False)
    aggregate_id: int = field(init=False)
    created_at: int = field(default_factory=lambda: int(time.time() * 1000), init=False)

    def __post_init__(self) -> None:
        object.__setattr__(self, "aggregate_id", self.league_id)


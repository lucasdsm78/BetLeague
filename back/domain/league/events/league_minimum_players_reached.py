from __future__ import annotations

from dataclasses import dataclass, field
import time

from domain.utils.domain_event import DomainEvent


@dataclass(frozen=True, slots=True)
class LeagueMinimumPlayersReached(DomainEvent):
    league_id: int
    league_name: str
    owner_user_id: int
    min_players: int
    current_players_count: int
    event_name: str = field(default="league.minimum_players_reached", init=False)
    aggregate_type: str = field(default="league", init=False)
    aggregate_id: int = field(init=False)
    created_at: int = field(default_factory=lambda: int(time.time() * 1000), init=False)

    def __post_init__(self):
        object.__setattr__(self, 'aggregate_id', int(self.league_id))


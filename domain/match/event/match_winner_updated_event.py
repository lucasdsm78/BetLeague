from dataclasses import dataclass


@dataclass
class MatchWinnerUpdatedEvent:
    match_id: int
    new_winner: str

@dataclass
class MatchUpdatedEvent:
    match_id: int
    event_type: str

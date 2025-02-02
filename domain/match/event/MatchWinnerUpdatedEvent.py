from dataclasses import dataclass


@dataclass
class MatchWinnerUpdatedEvent:
    match_id: int
    new_winner: str

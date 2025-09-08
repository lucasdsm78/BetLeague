from dataclasses import dataclass


@dataclass
class MatchChoiceStatusUpdatedEvent:
    ticket_id: int
    event_type: str

from __future__ import annotations

from dataclasses import dataclass, field

from domain.utils.domain_event import DomainEvent


@dataclass(frozen=True, slots=True)
class LeagueInvitationCreated(DomainEvent):

    league_id: int
    league_name: str
    invited_user_id: int
    sender_user_id: int
    sender_pseudo: str
    event_name: str = field(default="league.invitation.created", init=False)

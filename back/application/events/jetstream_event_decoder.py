from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from domain.league.events.league_invitation_accepted import LeagueInvitationAccepted
from domain.league.events.league_invitation_created import LeagueInvitationCreated
from domain.league.events.league_invitation_refused import LeagueInvitationRefused
from domain.league.events.league_started import LeagueStarted
from domain.match.event.match_result_resolved_event import MatchResultResolvedEvent
from domain.ticket.event.ticket_choices_resolved_event import TicketChoicesResolvedEvent
from domain.utils.domain_event import DomainEvent


class JetStreamEventDecodeError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class JetStreamDecodedEvent:
    event_name: str
    payload: dict[str, Any]
    event: DomainEvent


# Mapping stable: event_name -> (constructor)
_EVENT_BUILDERS: dict[str, Callable[[dict[str, Any]], DomainEvent]] = {
    "league.invitation.created": lambda p: LeagueInvitationCreated(
        league_id=int(p["league_id"]),
        sender_user_id=int(p["sender_user_id"]),
        invited_user_id=int(p["invited_user_id"]),
        league_name=str(p.get("league_name", "")),
        sender_pseudo=str(p.get("sender_pseudo", "")),
    ),
    "league.invitation.accepted": lambda p: LeagueInvitationAccepted(
        league_id=int(p["league_id"]),
        league_name=str(p.get("league_name", "")),
        invited_user_id=int(p["invited_user_id"]),
        invited_user_pseudo=str(p.get("invited_user_pseudo", "")),
        sender_user_id=int(p["sender_user_id"]),
    ),
    "league.invitation.refused": lambda p: LeagueInvitationRefused(
        league_id=int(p["league_id"]),
        league_name=str(p.get("league_name", "")),
        invited_user_id=int(p["invited_user_id"]),
        invited_user_pseudo=str(p.get("invited_user_pseudo", "")),
        sender_user_id=int(p["sender_user_id"]),
    ),
    "league.started": lambda p: LeagueStarted(
        league_id=int(p["league_id"]),
        league_name=str(p.get("league_name", "")),
    ),
    "ticket.choices.resolved": lambda p: TicketChoicesResolvedEvent(
        ticket_id=int(p["ticket_id"]),
        match_id=int(p["match_id"]),
    ),
    "match.result.resolved": lambda p: MatchResultResolvedEvent(
        match_id=int(p["match_id"]),
    ),
}


def decode_domain_event(payload: dict[str, Any]) -> JetStreamDecodedEvent:
    event_name = str(payload.get("event_name") or "").strip()
    if not event_name:
        raise JetStreamEventDecodeError("missing event_name")

    builder = _EVENT_BUILDERS.get(event_name)
    if builder is None:
        raise JetStreamEventDecodeError(f"unsupported event_name={event_name}")

    try:
        event = builder(payload)
    except KeyError as e:
        raise JetStreamEventDecodeError(f"missing field: {e}") from e
    except Exception as e:
        raise JetStreamEventDecodeError(f"invalid payload for {event_name}: {e}") from e

    return JetStreamDecodedEvent(event_name=event_name, payload=payload, event=event)


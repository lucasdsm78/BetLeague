from __future__ import annotations

import pytest

from application.events.jetstream_event_decoder import decode_domain_event, JetStreamEventDecodeError
from domain.ticket.event.ticket_choices_resolved_event import TicketChoicesResolvedEvent


def test_decode_ticket_choices_resolved() -> None:
    decoded = decode_domain_event(
        {
            "event_name": "ticket.choices.resolved",
            "ticket_id": 12,
            "match_id": 99,
        }
    )
    assert isinstance(decoded.event, TicketChoicesResolvedEvent)
    assert decoded.event.ticket_id == 12
    assert decoded.event.match_id == 99


def test_decode_missing_event_name() -> None:
    with pytest.raises(JetStreamEventDecodeError):
        decode_domain_event({"ticket_id": 1})


def test_decode_unknown_event_name() -> None:
    with pytest.raises(JetStreamEventDecodeError):
        decode_domain_event({"event_name": "unknown.event"})


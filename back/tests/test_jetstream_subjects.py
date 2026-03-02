from __future__ import annotations

from infrastructure.services.nats_jetstream import event_name_to_subject


def test_event_name_to_subject_prefix() -> None:
    assert event_name_to_subject("ticket.choices.resolved", subject_prefix="betleague") == (
        "betleague.ticket.choices.resolved"
    )


def test_event_name_to_subject_empty() -> None:
    assert event_name_to_subject("", subject_prefix="betleague") == "betleague.unknown"
    assert event_name_to_subject("   ", subject_prefix="betleague") == "betleague.unknown"


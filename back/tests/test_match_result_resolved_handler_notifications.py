from __future__ import annotations

import pytest

from application.match.handlers.match_result_resolved_handler import OnMatchResultResolvedCheckChoices
from domain.match.event.match_result_resolved_event import MatchResultResolvedEvent
from domain.ticket.event.ticket_choices_resolved_event import TicketChoicesResolvedEvent


class _AsyncContext:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    def begin(self):
        return _AsyncContext()


@pytest.mark.asyncio
async def test_match_result_resolved_handler_publishes_one_ticket_choice_event_per_unique_ticket(monkeypatch):
    published_events: list[object] = []

    class FakeMatchRepository:
        def __init__(self, session):
            pass

        async def find_by_id(self, match_id: int):
            return object()

    class FakeMatchChoicesRepository:
        def __init__(self, session):
            pass

        async def bulk_resolve_pending_for_match(self, match_id: int):
            assert match_id == 42
            return [9, 5, 9]

    class FakeOutboxBus:
        def __init__(self, session):
            pass

        async def publish(self, event):
            published_events.append(event)

    import application.match.handlers.match_result_resolved_handler as handler_module

    monkeypatch.setattr(handler_module, "MatchRepositoryImpl", FakeMatchRepository)
    monkeypatch.setattr(handler_module, "MatchChoicesRepositoryImpl", FakeMatchChoicesRepository)
    monkeypatch.setattr(handler_module, "OutboxDomainEventBus", FakeOutboxBus)

    handler = OnMatchResultResolvedCheckChoices(session_factory=lambda: _AsyncContext())

    await handler(MatchResultResolvedEvent(match_id=42))

    assert [(type(event), event.ticket_id, event.match_id) for event in published_events] == [
        (TicketChoicesResolvedEvent, 5, 42),
        (TicketChoicesResolvedEvent, 9, 42),
    ]


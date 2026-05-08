from __future__ import annotations

import pytest

from application.ticket.handlers.ticket_choices_resolved_handler import OnTicketChoicesResolvedCheckStatus
from domain.league.events.league_user_overtaken import LeagueUserOvertaken
from domain.ticket.event.ticket_choices_resolved_event import TicketChoicesResolvedEvent
from domain.ticket.event.ticket_resolved_event import TicketResolvedEvent
from domain.ticket.model.ticket_status import TicketStatus
from domain.user.model.user_summary import UserSummary


class _AsyncContext:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    def begin(self):
        return _AsyncContext()


class _Ticket:
    def __init__(self):
        self.id = 17
        self.status = TicketStatus.pending
        self.gain = 44.5
        self.league_id = 3
        self.user = UserSummary(id=8, email="lucas@example.com", pseudo="Lucas")


class _League:
    name = "League Elite"


@pytest.mark.asyncio
async def test_ticket_choices_resolved_handler_applies_win_and_publishes_ticket_and_overtake_events(monkeypatch):
    published_events: list[object] = []
    calls: list[str] = []
    ranking_reads: list[int] = []

    class FakeTicketRepository:
        def __init__(self, session):
            pass

        async def find_by_id_for_update(self, ticket_id: int):
            assert ticket_id == 17
            return _Ticket()

        async def resolve_status(self, ticket_id: int, wrong_count: int, pending_count: int):
            assert (ticket_id, wrong_count, pending_count) == (17, 0, 0)
            calls.append("resolve_status")
            return True

    class FakeMatchChoicesRepository:
        def __init__(self, session):
            pass

        async def count_wrong_and_pending_by_ticket(self, ticket_id: int):
            return (0, 0)

    class FakeUserRepository:
        def __init__(self, session):
            pass

        async def apply_ticket_win(self, user_id: int, gain: float):
            calls.append(f"user_win:{user_id}:{gain}")

        async def apply_ticket_lose(self, user_id: int):
            raise AssertionError("should not lose")

    class FakeLeaguePlayersRepository:
        def __init__(self, session):
            self.calls = 0

        async def get_league_ranking_entries(self, league_id: int):
            self.calls += 1
            ranking_reads.append(league_id)
            return ["ranking"]

        async def apply_ticket_win(self, league_id: int, user_id: int, gain: float):
            calls.append(f"league_win:{league_id}:{user_id}:{gain}")

        async def apply_ticket_lose(self, league_id: int, user_id: int):
            raise AssertionError("should not lose")

    class FakeLeagueRepository:
        def __init__(self, session):
            pass

        async def find_by_id(self, league_id: int):
            return _League()

    class FakeOutboxBus:
        def __init__(self, session):
            pass

        async def publish(self, event):
            published_events.append(event)

    def fake_build_overtaken_events(**kwargs):
        assert kwargs["ranking_entries"] == ["ranking"]
        assert kwargs["league_id"] == 3
        assert kwargs["league_name"] == "League Elite"
        assert kwargs["overtaken_by_user_id"] == 8
        assert kwargs["gain"] == 44.5
        return [
            LeagueUserOvertaken(
                league_id=3,
                league_name="League Elite",
                overtaken_user_id=9,
                overtaken_by_user_id=8,
                overtaken_by_pseudo="Lucas",
                previous_position=1,
                new_position=2,
            )
        ]

    import application.ticket.handlers.ticket_choices_resolved_handler as handler_module

    monkeypatch.setattr(handler_module, "TicketRepositoryImpl", FakeTicketRepository)
    monkeypatch.setattr(handler_module, "MatchChoicesRepositoryImpl", FakeMatchChoicesRepository)
    monkeypatch.setattr(handler_module, "UserRepositoryImpl", FakeUserRepository)
    monkeypatch.setattr(handler_module, "LeaguePlayersRepositoryImpl", FakeLeaguePlayersRepository)
    monkeypatch.setattr(handler_module, "LeagueRepositoryImpl", FakeLeagueRepository)
    monkeypatch.setattr(handler_module, "OutboxDomainEventBus", FakeOutboxBus)
    monkeypatch.setattr(handler_module, "build_overtaken_events", fake_build_overtaken_events)

    handler = OnTicketChoicesResolvedCheckStatus(session_factory=lambda: _AsyncContext())

    await handler(TicketChoicesResolvedEvent(ticket_id=17, match_id=42))

    assert calls == [
        "resolve_status",
        "user_win:8:44.5",
        "league_win:3:8:44.5",
    ]
    assert ranking_reads == [3]
    assert any(isinstance(event, TicketResolvedEvent) and event.ticket_id == 17 for event in published_events)
    assert any(isinstance(event, LeagueUserOvertaken) and event.overtaken_user_id == 9 for event in published_events)




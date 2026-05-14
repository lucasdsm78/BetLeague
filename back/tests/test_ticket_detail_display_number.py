from types import SimpleNamespace

import pytest

import application.ticket.ticket_query_usecase as query_module
from application.ticket.ticket_query_usecase import TicketQueryUseCaseImpl
from domain.user.model.email import Email


class FakeTransaction:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class FakeSession:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    def begin(self):
        return FakeTransaction()


class FakeUserRepository:
    def __init__(self, session):
        self.user = SimpleNamespace(id=7, email=Email('user@test.local'), pseudo='player')

    async def find_by_email(self, email: str):
        return self.user if email == 'user@test.local' else None


class FakeTicketRepository:
    def __init__(self, session):
        self.ticket = SimpleNamespace(
            id=15,
            uuid='ticket-15',
            mise=12,
            gain=24.5,
            status='pending',
            league_id=None,
            tournament_match_id=None,
            user=SimpleNamespace(id=7),
        )

    async def find_by_id(self, ticket_id: int):
        return self.ticket

    async def get_display_numbers_by_ticket_ids(self, user_id: int, ticket_ids: list[int]):
        return {15: 4}


class FakeMatchChoicesRepository:
    def __init__(self, session):
        pass

    async def find_all_by_ticket_id(self, ticket_id: int):
        return []


class FakeMatchRepository:
    def __init__(self, session):
        pass

    async def find_all_by_ids(self, ids):
        return []


class FakeMatchOddRepository:
    def __init__(self, session):
        pass

    async def find_all_by_ids(self, ids):
        return []


class FakeTournamentMatchRepository:
    def __init__(self, session):
        pass

    async def find_by_id(self, tournament_match_id: int):
        return None


@pytest.mark.asyncio
async def test_get_ticket_details_returns_display_number(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()
    fake_ticket_repo = FakeTicketRepository(session)

    monkeypatch.setattr(query_module, 'UserRepositoryImpl', FakeUserRepository)
    monkeypatch.setattr(query_module, 'TicketRepositoryImpl', lambda s: fake_ticket_repo)
    monkeypatch.setattr(query_module, 'MatchChoicesRepositoryImpl', FakeMatchChoicesRepository)
    monkeypatch.setattr(query_module, 'MatchRepositoryImpl', FakeMatchRepository)
    monkeypatch.setattr(query_module, 'MatchOddRepositoryImpl', FakeMatchOddRepository)
    monkeypatch.setattr(query_module, 'TournamentMatchRepositoryImpl', FakeTournamentMatchRepository)

    usecase = TicketQueryUseCaseImpl(
        session_factory=lambda: session,
        ticket_repository=SimpleNamespace(),
        league_repository=SimpleNamespace(),
        user_repository=SimpleNamespace(),
        match_choices_repository=SimpleNamespace(),
        match_repository=SimpleNamespace(),
    )

    result = await usecase.get_ticket_details(15, 'user@test.local')

    assert result.id == 15
    assert result.display_number == 4
    assert result.uuid == 'ticket-15'


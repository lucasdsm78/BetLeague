from types import SimpleNamespace

import pytest

import application.ticket.ticket_query_usecase as query_module
from application.ticket.ticket_query_usecase import TicketQueryUseCaseImpl
from domain.user.exception.user_exception import UserNotFoundError


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
        self.user = SimpleNamespace(id=7, email='user@test.local')

    async def find_by_email(self, email: str):
        return self.user if email == self.user.email else None


class FakeTicketRepository:
    def __init__(self, session):
        self.tickets = [
            SimpleNamespace(
                id=15,
                uuid='ticket-15',
                mise=12,
                gain=24.5,
                status='pending',
                league=None,
                tournament_match_id=33,
                tournament_match=SimpleNamespace(
                    id=33,
                    tournament_id=9,
                    stage_id=4,
                    type='quarter_final',
                    tournament=SimpleNamespace(name='Champions Sprint'),
                ),
                match_choices=[
                    SimpleNamespace(
                        id=91,
                        choice='Home',
                        status='pending',
                        match_odd_id=None,
                        match=SimpleNamespace(
                            id=101,
                            home_team='PSG',
                            away_team='OM',
                            time='2026-03-31T18:00:00Z',
                            winner=None,
                        ),
                    )
                ],
            )
        ]

    async def get_display_numbers_by_ticket_ids(self, user_id: int, ticket_ids: list[int]):
        return {15: 3}

    async def count_in_progress_by_user_id(self, user_id: int, league_id=None, is_tournament=None):
        return len(self.tickets)

    async def find_all_in_progress_by_user_id(self, user_id: int, page: int = 1, page_size: int = 20, league_id=None, is_tournament=None):
        return self.tickets


class FakeMatchOddRepository:
    def __init__(self, session):
        pass

    async def find_all_by_ids(self, ids):
        return []


@pytest.mark.asyncio
async def test_get_tickets_in_progress_exposes_tournament_name(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()
    fake_ticket_repo = FakeTicketRepository(session)

    monkeypatch.setattr(query_module, 'UserRepositoryImpl', FakeUserRepository)
    monkeypatch.setattr(query_module, 'TicketRepositoryImpl', lambda s: fake_ticket_repo)
    monkeypatch.setattr(query_module, 'MatchOddRepositoryImpl', FakeMatchOddRepository)

    usecase = TicketQueryUseCaseImpl(
        session_factory=lambda: session,
        ticket_repository=SimpleNamespace(),
        league_repository=SimpleNamespace(),
        user_repository=SimpleNamespace(),
        match_choices_repository=SimpleNamespace(),
        match_repository=SimpleNamespace(),
    )

    result = await usecase.get_tickets_in_progress('user@test.local')

    assert result.total == 1
    assert len(result.tickets) == 1
    assert result.tickets[0].display_number == 3
    assert result.tickets[0].tournament_match_summary is not None
    assert result.tickets[0].tournament_match_summary.tournament_id == 9
    assert result.tickets[0].tournament_match_summary.name == 'Champions Sprint'


@pytest.mark.asyncio
async def test_get_tickets_in_progress_raises_when_user_is_missing(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()
    fake_ticket_repo = FakeTicketRepository(session)

    monkeypatch.setattr(query_module, 'UserRepositoryImpl', FakeUserRepository)
    monkeypatch.setattr(query_module, 'TicketRepositoryImpl', lambda s: fake_ticket_repo)
    monkeypatch.setattr(query_module, 'MatchOddRepositoryImpl', FakeMatchOddRepository)

    usecase = TicketQueryUseCaseImpl(
        session_factory=lambda: session,
        ticket_repository=SimpleNamespace(),
        league_repository=SimpleNamespace(),
        user_repository=SimpleNamespace(),
        match_choices_repository=SimpleNamespace(),
        match_repository=SimpleNamespace(),
    )

    with pytest.raises(UserNotFoundError):
        await usecase.get_tickets_in_progress('absent@test.local')


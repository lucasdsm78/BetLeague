from types import SimpleNamespace

import pytest

import application.ticket.ticket_query_usecase as query_module
from application.ticket.ticket_query_usecase import TicketQueryUseCaseImpl
from domain.ticket.exception.ticket_exception import TicketNotFoundError, TicketNotShareableError
from domain.ticket.model.ticket_status import TicketStatus
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


class FakeTicketRepository:
    def __init__(self, session):
        self.status = TicketStatus.correct
        self.ticket = None

    async def find_by_uuid(self, ticket_uuid: str):
        if self.ticket is not None:
            return self.ticket
        return SimpleNamespace(
            id=4,
            uuid=ticket_uuid,
            mise=10,
            gain=28.5,
            status=self.status,
            league_id=11,
            tournament_match_id=None,
        )


class FakeLeagueRepository:
    def __init__(self, session):
        pass

    async def find_by_id(self, league_id: int):
        return SimpleNamespace(id=league_id, name='Ligue VIP')


class FakeMatchChoicesRepository:
    def __init__(self, session):
        pass

    async def find_all_by_ticket_id(self, ticket_id: int):
        return [
            SimpleNamespace(
                id=90,
                match_id=101,
                match_odd_id=None,
                choice='Home',
                status='CORRECT',
            )
        ]


class FakeMatchRepository:
    def __init__(self, session):
        pass

    async def find_all_by_ids(self, ids):
        return [
            SimpleNamespace(
                id=101,
                home_team='PSG',
                away_team='OM',
                time='2026-03-31T18:00:00Z',
                winner='PSG',
            )
        ]


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
async def test_get_shared_ticket_returns_public_payload_for_correct_ticket(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()
    fake_ticket_repo = FakeTicketRepository(session)

    monkeypatch.setattr(query_module, 'TicketRepositoryImpl', lambda s: fake_ticket_repo)
    monkeypatch.setattr(query_module, 'LeagueRepositoryImpl', FakeLeagueRepository)
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

    result = await usecase.get_shared_ticket_details('ticket-uuid')

    assert result.uuid == 'ticket-uuid'
    assert result.gain == 28.5
    assert result.league_summary is not None
    assert result.league_summary.name == 'Ligue VIP'
    assert len(result.match_choice_summaries) == 1


@pytest.mark.asyncio
async def test_get_shared_ticket_rejects_non_correct_ticket(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()
    fake_ticket_repo = FakeTicketRepository(session)
    fake_ticket_repo.status = TicketStatus.wrong

    monkeypatch.setattr(query_module, 'TicketRepositoryImpl', lambda s: fake_ticket_repo)
    monkeypatch.setattr(query_module, 'LeagueRepositoryImpl', FakeLeagueRepository)
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

    with pytest.raises(TicketNotShareableError):
        await usecase.get_shared_ticket_details('ticket-uuid')


@pytest.mark.asyncio
async def test_get_shared_ticket_raises_404_when_missing(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()
    fake_ticket_repo = FakeTicketRepository(session)
    fake_ticket_repo.ticket = None

    async def _missing(ticket_uuid: str):
        return None

    fake_ticket_repo.find_by_uuid = _missing

    monkeypatch.setattr(query_module, 'TicketRepositoryImpl', lambda s: fake_ticket_repo)
    monkeypatch.setattr(query_module, 'LeagueRepositoryImpl', FakeLeagueRepository)
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

    with pytest.raises(TicketNotFoundError):
        await usecase.get_shared_ticket_details('missing-uuid')


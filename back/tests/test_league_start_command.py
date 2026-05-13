from types import SimpleNamespace

import pytest

import application.league.league_command_usecase as command_module
from application.league.league_command_model import LeagueUpdateModel
from application.league.league_command_usecase import LeagueCommandUseCaseImpl
from domain.league.events.league_minimum_players_reached import LeagueMinimumPlayersReached
from domain.league.events.league_started import LeagueStarted
from domain.league.exception.league_exception import LeagueMinimumPlayersNotReachedError
from domain.league.model.league import League, LeagueStatus
from domain.user.model.email import Email
from domain.user.model.user_summary import UserSummary


class FakeTransaction:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class FakeSession:
    def __init__(self):
        self.user = None
        self.league = None
        self.players_count = 0
        self.updated_league = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    def begin(self):
        return FakeTransaction()


class FakeUserRepository:
    def __init__(self, session):
        self.session = session

    async def find_by_email(self, email: str):
        return self.session.user


class FakeLeagueRepository:
    def __init__(self, session):
        self.session = session

    async def find_by_id_for_update(self, league_id: int):
        return self.session.league

    async def find_by_id(self, league_id: int):
        return self.session.league

    async def find_by_name(self, name: str):
        return False

    async def update(self, league):
        self.session.updated_league = league
        return league


class FakeLeaguePlayersRepository:
    def __init__(self, session):
        self.session = session

    async def count_players(self, league_id: int):
        return self.session.players_count


class FakeEventBus:
    def __init__(self):
        self.events = []

    async def publish(self, event):
        self.events.append(event)


def make_league(*, owner_id: int = 7, min_players: int = 4, is_started: bool = False):
    return League(
        id=12,
        uuid='league-uuid',
        name='Ligue Premium',
        is_free=True,
        is_started=is_started,
        max_players=8,
        min_players=min_players,
        is_private=False,
        start_date=1_710_000_000_000,
        end_date=1_710_604_800_000,
        nb_players_remaining=5,
        status=LeagueStatus.OPEN if not is_started else LeagueStatus.IN_PROGRESS,
        user=UserSummary(id=owner_id, email=Email('owner@example.com'), pseudo='owner'),
    )


@pytest.mark.asyncio
async def test_start_league_starts_manually_and_publishes_event(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()
    session.user = SimpleNamespace(id=7, email=Email('owner@example.com'), pseudo='owner')
    session.league = make_league()
    session.players_count = 4
    event_bus = FakeEventBus()

    monkeypatch.setattr(command_module, 'UserRepositoryImpl', FakeUserRepository)
    monkeypatch.setattr(command_module, 'LeagueRepositoryImpl', FakeLeagueRepository)
    monkeypatch.setattr(command_module, 'LeaguePlayersRepositoryImpl', FakeLeaguePlayersRepository)

    usecase = LeagueCommandUseCaseImpl(
        league_repository=SimpleNamespace(),
        user_repository=SimpleNamespace(),
        session_factory=lambda: session,
        league_players_repository=SimpleNamespace(),
        invitation_repository=SimpleNamespace(),
        event_bus=event_bus,
    )

    result = await usecase.start_league(12, 'owner@example.com')

    assert result.message == 'The league is well started.'
    assert session.updated_league is session.league
    assert session.league.is_started is True
    assert session.league.status == LeagueStatus.IN_PROGRESS
    assert any(isinstance(event, LeagueStarted) for event in event_bus.events)
    started_event = next(event for event in event_bus.events if isinstance(event, LeagueStarted))
    assert started_event.started_by_user_id == 7


@pytest.mark.asyncio
async def test_start_league_rejects_when_minimum_players_not_reached(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()
    session.user = SimpleNamespace(id=7, email=Email('owner@example.com'), pseudo='owner')
    session.league = make_league(min_players=5)
    session.players_count = 4

    monkeypatch.setattr(command_module, 'UserRepositoryImpl', FakeUserRepository)
    monkeypatch.setattr(command_module, 'LeagueRepositoryImpl', FakeLeagueRepository)
    monkeypatch.setattr(command_module, 'LeaguePlayersRepositoryImpl', FakeLeaguePlayersRepository)

    usecase = LeagueCommandUseCaseImpl(
        league_repository=SimpleNamespace(),
        user_repository=SimpleNamespace(),
        session_factory=lambda: session,
        league_players_repository=SimpleNamespace(),
        invitation_repository=SimpleNamespace(),
        event_bus=FakeEventBus(),
    )

    with pytest.raises(LeagueMinimumPlayersNotReachedError):
        await usecase.start_league(12, 'owner@example.com')


@pytest.mark.asyncio
async def test_update_league_publishes_minimum_players_reached_when_threshold_becomes_reachable(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()
    session.user = SimpleNamespace(id=7, email=Email('owner@example.com'), pseudo='owner')
    session.league = make_league(min_players=6)
    session.players_count = 4
    event_bus = FakeEventBus()

    monkeypatch.setattr(command_module, 'UserRepositoryImpl', FakeUserRepository)
    monkeypatch.setattr(command_module, 'LeagueRepositoryImpl', FakeLeagueRepository)
    monkeypatch.setattr(command_module, 'LeaguePlayersRepositoryImpl', FakeLeaguePlayersRepository)

    usecase = LeagueCommandUseCaseImpl(
        league_repository=SimpleNamespace(),
        user_repository=SimpleNamespace(),
        session_factory=lambda: session,
        league_players_repository=SimpleNamespace(),
        invitation_repository=SimpleNamespace(),
        event_bus=event_bus,
    )

    await usecase.update_league(
        LeagueUpdateModel(
            name='Ligue Premium',
            max_players=8,
            min_players=4,
            start_date=1_710_000_000_000,
        ),
        12,
        'owner@example.com',
    )

    minimum_reached_event = next(event for event in event_bus.events if isinstance(event, LeagueMinimumPlayersReached))
    assert minimum_reached_event.owner_user_id == 7
    assert minimum_reached_event.min_players == 4
    assert minimum_reached_event.current_players_count == 4


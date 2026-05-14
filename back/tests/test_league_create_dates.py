from types import SimpleNamespace

import pytest

import application.league.league_command_usecase as command_module
from application.league.constants import LEAGUE_DURATION_DAYS
from application.league.league_command_model import LeagueCreateModel
from application.league.league_command_usecase import LeagueCommandUseCaseImpl
from domain.user.model.email import Email

DAY_MS = 24 * 60 * 60 * 1000


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
        self.session = session

    async def find_by_email(self, email: str):
        return SimpleNamespace(id=7, email=Email(email), pseudo='captain')

    async def debit_btl_if_enough(self, user_id: int, amount: float):
        return True


class FakeLeagueRepository:
    def __init__(self, session):
        self.session = session
        self.created_league = None

    async def find_by_name(self, name: str):
        return None

    async def create(self, league):
        self.created_league = league
        self.session.created_league = league

    async def find_by_uuid(self, uuid: str):
        league = self.session.created_league
        league.id = 12
        return league


class FakeLeaguePlayersRepository:
    def __init__(self, session):
        self.session = session
        self.joined = None

    async def join_league(self, league_player):
        self.joined = league_player
        self.session.joined_player = league_player


@pytest.mark.asyncio
async def test_create_league_uses_custom_start_date_and_auto_computes_end_date(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()
    league_repo = FakeLeagueRepository(session)
    players_repo = FakeLeaguePlayersRepository(session)

    monkeypatch.setattr(command_module, 'UserRepositoryImpl', FakeUserRepository)
    monkeypatch.setattr(command_module, 'LeagueRepositoryImpl', lambda s: league_repo)
    monkeypatch.setattr(command_module, 'LeaguePlayersRepositoryImpl', lambda s: players_repo)

    usecase = LeagueCommandUseCaseImpl(
        league_repository=SimpleNamespace(),
        user_repository=SimpleNamespace(),
        session_factory=lambda: session,
        league_players_repository=SimpleNamespace(),
        invitation_repository=SimpleNamespace(),
        event_bus=SimpleNamespace(),
    )

    custom_start_ms = 1_735_689_600_000
    payload = LeagueCreateModel(
        name='Ligue programmee',
        max_players=10,
        min_players=4,
        is_private=True,
        is_free=True,
        start_date=custom_start_ms,
    )

    result = await usecase.create_league(payload, 'owner@example.com')

    assert result.message == 'La ligue a bien été créée.'
    assert league_repo.created_league is not None
    assert league_repo.created_league.start_date == custom_start_ms
    assert league_repo.created_league.end_date == custom_start_ms + LEAGUE_DURATION_DAYS * DAY_MS
    assert players_repo.joined is not None
    assert players_repo.joined.league_id == 12
    assert players_repo.joined.user_id == 7


def test_league_create_model_accepts_start_date_in_milliseconds():
    payload = LeagueCreateModel(
        name='Ligue test',
        max_players=10,
        min_players=3,
        is_private=False,
        is_free=True,
        start_date=1_735_689_600_000,
    )

    assert payload.start_date == 1_735_689_600_000


@pytest.mark.parametrize('invalid_start_date', [1_735_689_600, -1])
def test_league_create_model_rejects_invalid_start_date(invalid_start_date: int):
    with pytest.raises(ValueError):
        LeagueCreateModel(
            name='Ligue test',
            max_players=10,
            min_players=3,
            is_private=False,
            is_free=True,
            start_date=invalid_start_date,
        )


def test_league_create_model_rejects_min_players_above_max_players():
    with pytest.raises(ValueError):
        LeagueCreateModel(
            name='Ligue test',
            max_players=10,
            min_players=11,
            is_private=False,
            is_free=True,
            start_date=1_735_689_600_000,
        )



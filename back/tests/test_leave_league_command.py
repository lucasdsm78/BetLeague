from types import SimpleNamespace

import pytest

import application.league.league_command_usecase as command_module
from application.league.league_command_usecase import LeagueCommandUseCaseImpl
from domain.league.exception.league_exception import LeagueParticipantNotFoundError
from domain.league.model.league import League, LeagueStatus
from domain.league.model.league_players import LeaguePlayers
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
        self.league_player = None
        self.credits: list[tuple[int, float]] = []
        self.updated_league = None
        self.deleted_league_player_id = None

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

    async def credit_btl(self, user_id: int, amount: float):
        self.session.credits.append((user_id, amount))


class FakeLeagueRepository:
    def __init__(self, session):
        self.session = session

    async def find_by_id(self, league_id: int):
        return self.session.league

    async def increment_players_remaining(self, league_id: int):
        self.session.league.nb_players_remaining = int(self.session.league.nb_players_remaining or 0) + 1
        return self.session.league

    async def update(self, league):
        self.session.updated_league = league
        return league


class FakeLeaguePlayersRepository:
    def __init__(self, session):
        self.session = session

    async def get_participation(self, league_id: int, user_id: int):
        if self.session.league_player is None:
            raise LeagueParticipantNotFoundError
        return self.session.league_player

    async def delete_player(self, league_player_id: int):
        self.session.deleted_league_player_id = league_player_id


def make_league(*, is_free: bool = False, nb_btl: int = 25, nb_players_remaining: int = 0):
    return League(
        id=10,
        uuid="league-10",
        name="League 10",
        is_free=is_free,
        nb_btl=nb_btl,
        is_started=False,
        status=LeagueStatus.OPEN,
        max_players=8,
        is_private=False,
        start_date=1_735_689_600_000,
        end_date=1_736_294_400_000,
        nb_players_remaining=nb_players_remaining,
        user=UserSummary(id=42, email=Email("owner@example.com"), pseudo="owner"),
    )


@pytest.mark.asyncio
async def test_leave_league_unregisters_participant_without_accessing_missing_user_attribute(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()
    session.user = SimpleNamespace(id=7, email=Email("player@example.com"), pseudo="player")
    session.league = make_league(is_free=False, nb_btl=25, nb_players_remaining=0)
    session.league_player = LeaguePlayers(
        id=99,
        user_id=7,
        league_id=10,
        nb_btl=25,
        btl_from_tickets=0,
        nb_win=0,
        nb_lose=0,
    )

    monkeypatch.setattr(command_module, "UserRepositoryImpl", FakeUserRepository)
    monkeypatch.setattr(command_module, "LeagueRepositoryImpl", FakeLeagueRepository)
    monkeypatch.setattr(command_module, "LeaguePlayersRepositoryImpl", FakeLeaguePlayersRepository)

    usecase = LeagueCommandUseCaseImpl(
        league_repository=SimpleNamespace(),
        user_repository=SimpleNamespace(),
        session_factory=lambda: session,
        league_players_repository=SimpleNamespace(),
        invitation_repository=SimpleNamespace(),
        event_bus=SimpleNamespace(),
    )

    result = await usecase.delete_league_player(10, "player@example.com")

    assert result.message == "Le joueur a bien été retiré de la ligue."
    assert session.deleted_league_player_id == 99
    assert session.credits == [(7, 25.0)]
    assert session.updated_league is session.league
    assert session.league.nb_players_remaining == 1


@pytest.mark.asyncio
async def test_leave_league_raises_when_participant_not_registered(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()
    session.user = SimpleNamespace(id=7, email=Email("player@example.com"), pseudo="player")
    session.league = make_league(is_free=True, nb_btl=0, nb_players_remaining=0)
    session.league_player = None

    monkeypatch.setattr(command_module, "UserRepositoryImpl", FakeUserRepository)
    monkeypatch.setattr(command_module, "LeagueRepositoryImpl", FakeLeagueRepository)
    monkeypatch.setattr(command_module, "LeaguePlayersRepositoryImpl", FakeLeaguePlayersRepository)

    usecase = LeagueCommandUseCaseImpl(
        league_repository=SimpleNamespace(),
        user_repository=SimpleNamespace(),
        session_factory=lambda: session,
        league_players_repository=SimpleNamespace(),
        invitation_repository=SimpleNamespace(),
        event_bus=SimpleNamespace(),
    )

    with pytest.raises(LeagueParticipantNotFoundError):
        await usecase.delete_league_player(10, "player@example.com")

    assert session.deleted_league_player_id is None
    assert session.updated_league is None
    assert session.credits == []


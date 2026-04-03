from types import SimpleNamespace
from datetime import datetime, timedelta

import pytest

import application.league.league_command_usecase as command_module
from application.league.league_command_usecase import LeagueCommandUseCaseImpl
from domain.league.model.league import League, LeagueStatus
from domain.user.model.email import Email
from domain.user.model.user_summary import UserSummary


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


def build_league(*, league_id: int, is_free: bool, nb_btl: int | None = None, winner_id: int | None = None, status: LeagueStatus = LeagueStatus.IN_PROGRESS):
    now = datetime.utcnow()
    return League(
        id=league_id,
        uuid=f"league-{league_id}",
        name=f"League {league_id}",
        is_free=is_free,
        nb_btl=nb_btl,
        is_started=status == LeagueStatus.IN_PROGRESS,
        status=status,
        max_players=16,
        is_private=False,
        start_date=int((now - timedelta(days=8)).timestamp() * 1000),
        end_date=int((now - timedelta(days=1)).timestamp() * 1000),
        nb_players_remaining=0,
        winner_id=winner_id,
        user=UserSummary(id=1, email=Email("owner@example.com"), pseudo="owner"),
    )


class FakeUserRepository:
    def __init__(self, session):
        self.session = session

    async def credit_btl(self, user_id: int, amount: float):
        self.session.credits.append((user_id, amount))


class FakeLeagueRepository:
    def __init__(self, session):
        self.session = session

    async def find_ended_before_not_paid(self, as_of: datetime):
        return self.session.leagues

    async def get_top_scorer(self, league_id: int):
        return self.session.top_scorers.get(league_id, (None, 0))

    async def count_players(self, league_id: int):
        return self.session.players_count.get(league_id, 0)

    async def update(self, league):
        self.session.updated_leagues.append(league)


@pytest.mark.asyncio
async def test_process_payouts_closes_free_league_and_credits_fixed_reward(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()
    session.leagues = [build_league(league_id=10, is_free=True)]
    session.top_scorers = {10: (77, 340)}
    session.players_count = {10: 16}
    session.credits = []
    session.updated_leagues = []

    monkeypatch.setattr(command_module, "UserRepositoryImpl", FakeUserRepository)
    monkeypatch.setattr(command_module, "LeagueRepositoryImpl", FakeLeagueRepository)

    usecase = LeagueCommandUseCaseImpl(
        league_repository=None,
        user_repository=None,
        session_factory=lambda: session,
        league_players_repository=None,
        invitation_repository=None,
        event_bus=None,
    )

    await usecase.process_payouts(datetime.utcnow())

    assert session.credits == [(77, 200.0)]
    assert len(session.updated_leagues) == 1
    updated_league = session.updated_leagues[0]
    assert updated_league.status == LeagueStatus.CLOSED
    assert updated_league.winner_id == 77
    assert updated_league.rewarded_amount == 200.0
    assert updated_league.reward_paid_at is not None
    assert updated_league.closed_at is not None


@pytest.mark.asyncio
async def test_process_payouts_closes_paid_league_and_credits_prize_pool(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()
    session.leagues = [build_league(league_id=11, is_free=False, nb_btl=25, winner_id=91)]
    session.top_scorers = {}
    session.players_count = {11: 12}
    session.credits = []
    session.updated_leagues = []

    monkeypatch.setattr(command_module, "UserRepositoryImpl", FakeUserRepository)
    monkeypatch.setattr(command_module, "LeagueRepositoryImpl", FakeLeagueRepository)

    usecase = LeagueCommandUseCaseImpl(
        league_repository=None,
        user_repository=None,
        session_factory=lambda: session,
        league_players_repository=None,
        invitation_repository=None,
        event_bus=None,
    )

    await usecase.process_payouts(datetime.utcnow())

    assert session.credits == [(91, 300.0)]
    updated_league = session.updated_leagues[0]
    assert updated_league.status == LeagueStatus.CLOSED
    assert updated_league.rewarded_amount == 300.0


@pytest.mark.asyncio
async def test_process_payouts_is_idempotent_for_closed_league(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()
    closed_league = build_league(league_id=12, is_free=True, winner_id=42, status=LeagueStatus.CLOSED)
    closed_league.is_started = False
    session.leagues = [closed_league]
    session.top_scorers = {12: (42, 500)}
    session.players_count = {12: 16}
    session.credits = []
    session.updated_leagues = []

    monkeypatch.setattr(command_module, "UserRepositoryImpl", FakeUserRepository)
    monkeypatch.setattr(command_module, "LeagueRepositoryImpl", FakeLeagueRepository)

    usecase = LeagueCommandUseCaseImpl(
        league_repository=None,
        user_repository=None,
        session_factory=lambda: session,
        league_players_repository=None,
        invitation_repository=None,
        event_bus=None,
    )

    await usecase.process_payouts(datetime.utcnow())

    assert session.credits == []
    assert session.updated_leagues == []


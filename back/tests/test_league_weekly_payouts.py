from datetime import UTC, datetime, timedelta

import pytest

import application.league.league_payout_usecase as payout_module
from application.league.league_payout_usecase import LeaguePayoutUseCaseImpl
from infrastructure.scheduler.league_payout_scheduler import LeaguePayoutSchedulerImpl
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
    now = datetime.now(UTC)
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

    async def find_due_payout_ids(self, as_of: datetime):
        return self.session.league_ids

    async def find_by_id_for_update(self, league_id: int):
        return self.session.leagues_by_id.get(league_id)

    async def get_top_scorer(self, league_id: int):
        return self.session.top_scorers.get(league_id, (None, 0))

    async def count_players(self, league_id: int):
        return self.session.players_count.get(league_id, 0)

    async def update(self, league):
        self.session.updated_leagues.append(league)


@pytest.mark.asyncio
async def test_process_league_payout_closes_free_league_and_credits_fixed_reward(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()
    session.league_ids = [10]
    session.leagues_by_id = {10: build_league(league_id=10, is_free=True)}
    session.top_scorers = {10: (77, 340)}
    session.players_count = {10: 16}
    session.credits = []
    session.updated_leagues = []

    monkeypatch.setattr(payout_module, "UserRepositoryImpl", FakeUserRepository)
    monkeypatch.setattr(payout_module, "LeagueRepositoryImpl", FakeLeagueRepository)

    usecase = LeaguePayoutUseCaseImpl(
        session_factory=lambda: session,
    )

    due_ids = await usecase.get_due_league_ids(datetime.now(UTC))
    assert due_ids == [10]

    await usecase.process_league_payout(10, datetime.now(UTC))

    assert session.credits == [(77, 200.0)]
    assert len(session.updated_leagues) == 1
    updated_league = session.updated_leagues[0]
    assert updated_league.status == LeagueStatus.CLOSED
    assert updated_league.winner_id == 77
    assert updated_league.rewarded_amount == 200.0
    assert updated_league.reward_paid_at is not None
    assert updated_league.closed_at is not None


@pytest.mark.asyncio
async def test_process_league_payout_closes_paid_league_and_credits_prize_pool(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()
    session.league_ids = [11]
    session.leagues_by_id = {11: build_league(league_id=11, is_free=False, nb_btl=25, winner_id=91)}
    session.top_scorers = {}
    session.players_count = {11: 12}
    session.credits = []
    session.updated_leagues = []

    monkeypatch.setattr(payout_module, "UserRepositoryImpl", FakeUserRepository)
    monkeypatch.setattr(payout_module, "LeagueRepositoryImpl", FakeLeagueRepository)

    usecase = LeaguePayoutUseCaseImpl(
        session_factory=lambda: session,
    )

    await usecase.process_league_payout(11, datetime.now(UTC))

    assert session.credits == [(91, 300.0)]
    updated_league = session.updated_leagues[0]
    assert updated_league.status == LeagueStatus.CLOSED
    assert updated_league.rewarded_amount == 300.0


@pytest.mark.asyncio
async def test_process_league_payout_is_idempotent_for_closed_league(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()
    closed_league = build_league(league_id=12, is_free=True, winner_id=42, status=LeagueStatus.CLOSED)
    closed_league.is_started = False
    session.league_ids = [12]
    session.leagues_by_id = {12: closed_league}
    session.top_scorers = {12: (42, 500)}
    session.players_count = {12: 16}
    session.credits = []
    session.updated_leagues = []

    monkeypatch.setattr(payout_module, "UserRepositoryImpl", FakeUserRepository)
    monkeypatch.setattr(payout_module, "LeagueRepositoryImpl", FakeLeagueRepository)

    usecase = LeaguePayoutUseCaseImpl(
        session_factory=lambda: session,
    )

    await usecase.process_league_payout(12, datetime.now(UTC))

    assert session.credits == []
    assert session.updated_leagues == []


@pytest.mark.asyncio
async def test_process_league_payout_does_not_close_league_when_winner_is_missing(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()
    session.league_ids = [13]
    session.leagues_by_id = {13: build_league(league_id=13, is_free=False, nb_btl=50)}
    session.top_scorers = {13: (None, 0)}
    session.players_count = {13: 3}
    session.credits = []
    session.updated_leagues = []

    monkeypatch.setattr(payout_module, "UserRepositoryImpl", FakeUserRepository)
    monkeypatch.setattr(payout_module, "LeagueRepositoryImpl", FakeLeagueRepository)

    usecase = LeaguePayoutUseCaseImpl(
        session_factory=lambda: session,
    )

    await usecase.process_league_payout(13, datetime.now(UTC))

    assert session.credits == []
    assert session.updated_leagues == []


@pytest.mark.asyncio
async def test_scheduler_orchestrates_each_due_league_once(monkeypatch: pytest.MonkeyPatch):
    calls: list[tuple[str, int | None]] = []

    class FakeLeaguePayoutUseCase:
        def __init__(self, session_factory):
            self.session_factory = session_factory

        async def get_due_league_ids(self, as_of: datetime):
            calls.append(("list", None))
            return [10, 11, 12]

        async def process_league_payout(self, league_id: int, as_of: datetime):
            calls.append(("process", league_id))

    monkeypatch.setattr(
        "infrastructure.scheduler.league_payout_scheduler.LeaguePayoutUseCaseImpl",
        FakeLeaguePayoutUseCase,
    )

    scheduler = LeaguePayoutSchedulerImpl(session_factory=lambda: FakeSession())
    await scheduler.process_due_payouts(datetime.now(UTC))

    assert calls == [
        ("list", None),
        ("process", 10),
        ("process", 11),
        ("process", 12),
    ]




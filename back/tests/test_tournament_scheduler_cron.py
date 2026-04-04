from datetime import UTC, datetime, timedelta

import pytest

from domain.tournament.model.stage_type import StageType
from domain.tournament.model.tournament import Tournament
from domain.tournament.model.tournament_player import TournamentPlayer
from domain.tournament.model.tournament_stage import TournamentStage
from domain.tournament.model.tournament_status import TournamentStatus
from domain.user.model.email import Email
from domain.user.model.user_summary import UserSummary
from infrastructure.celery.celery_app import celery_app
from infrastructure.scheduler.tournament_scheduler import TournamentSchedulerImpl


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


def build_tournament(tournament_id: int) -> Tournament:
    now = datetime.now(UTC)
    return Tournament(
        id=tournament_id,
        uuid=f"tournament-{tournament_id}",
        name=f"Tournament {tournament_id}",
        status=TournamentStatus.IN_PROGRESS,
        max_players=16,
        min_players=2,
        current_players=2,
        entry_fee=0,
        prize_pool=0,
        is_private=False,
        start_date=int((now - timedelta(days=7)).timestamp() * 1000),
        end_date=int((now + timedelta(days=7)).timestamp() * 1000),
        user=UserSummary(id=1, email=Email("owner@example.com"), pseudo="owner"),
    )


def build_stage(*, tournament_id: int, stage_id: int, stage_type: StageType, end_delta_minutes: int, is_active: bool = True) -> TournamentStage:
    now = datetime.now(UTC)
    return TournamentStage(
        id=stage_id,
        user_id=1,
        tournament_id=tournament_id,
        type=stage_type,
        start_date=int((now - timedelta(days=1)).timestamp() * 1000),
        end_date=int((now + timedelta(minutes=end_delta_minutes)).timestamp() * 1000),
        is_active=is_active,
        is_completed=False,
    )


class FakeTournamentRepository:
    def __init__(self, session):
        self.session = session

    async def find_all_by_status(self, status: str):
        return self.session.tournaments

    async def update(self, tournament: Tournament):
        self.session.updated_tournaments.append(tournament)


class FakeTournamentStageRepository:
    def __init__(self, session):
        self.session = session

    async def find_all_by_tournament(self, tournament_id: int):
        return self.session.stages_by_tournament.get(tournament_id, [])

    async def update_stage(self, stage: TournamentStage):
        self.session.updated_stages.append(stage)


class FakeTournamentMatchRepository:
    def __init__(self, session):
        self.session = session

    async def find_matches_by_tournament_id(self, tournament_id: int):
        return self.session.matches_by_tournament.get(tournament_id, [])

    async def find_matches_by_tournament_stages(self, tournament_id: int, stage: str):
        return []

    async def update(self, match):
        self.session.updated_matches.append(match)

    async def add_match(self, match):
        self.session.created_matches.append(match)


class FakeTournamentPlayersRepository:
    def __init__(self, session):
        self.session = session

    async def find_players_by_tournament_id(self, tournament_id: int):
        return self.session.players_by_tournament.get(tournament_id, [])

    async def update(self, player):
        self.session.updated_players.append(player)


class FakeUserRepository:
    def __init__(self, session):
        self.session = session

    async def credit_btl(self, user_id: int, amount: float):
        self.session.credits.append((user_id, amount))


@pytest.mark.asyncio
async def test_tournament_scheduler_skips_stage_not_due(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()
    tournament = build_tournament(10)
    stage = build_stage(tournament_id=10, stage_id=100, stage_type=StageType.FINAL, end_delta_minutes=30)

    session.tournaments = [tournament]
    session.stages_by_tournament = {10: [stage]}
    session.matches_by_tournament = {10: []}
    session.players_by_tournament = {10: []}
    session.updated_tournaments = []
    session.updated_stages = []
    session.updated_matches = []
    session.updated_players = []
    session.created_matches = []
    session.credits = []

    monkeypatch.setattr("infrastructure.scheduler.tournament_scheduler.TournamentRepositoryImpl", FakeTournamentRepository)
    monkeypatch.setattr("infrastructure.scheduler.tournament_scheduler.TournamentStageRepositoryImpl", FakeTournamentStageRepository)
    monkeypatch.setattr("infrastructure.scheduler.tournament_scheduler.TournamentMatchRepositoryImpl", FakeTournamentMatchRepository)
    monkeypatch.setattr("infrastructure.scheduler.tournament_scheduler.TournamentPlayersRepositoryImpl", FakeTournamentPlayersRepository)
    monkeypatch.setattr("infrastructure.scheduler.tournament_scheduler.UserRepositoryImpl", FakeUserRepository)

    scheduler = TournamentSchedulerImpl(session_factory=lambda: session)
    await scheduler.process_tournaments(as_of=datetime.now(UTC))

    assert session.updated_stages == []
    assert session.updated_tournaments == []
    assert session.credits == []


@pytest.mark.asyncio
async def test_tournament_scheduler_processes_due_final_stage_and_credits_winner(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()
    tournament = build_tournament(11)
    stage = build_stage(tournament_id=11, stage_id=110, stage_type=StageType.FINAL, end_delta_minutes=-30)
    player1 = TournamentPlayer(id=1, user_id=3, tournament_id=11, nb_btl=50, current_stage=StageType.FINAL)
    player2 = TournamentPlayer(id=2, user_id=4, tournament_id=11, nb_btl=140, current_stage=StageType.FINAL)
    match = type("Match", (), {"id": 501, "stage_id": 110, "winner_id": None, "loser_id": None, "player1_id": 1, "player2_id": 2})()

    session.tournaments = [tournament]
    session.stages_by_tournament = {11: [stage]}
    session.matches_by_tournament = {11: [match]}
    session.players_by_tournament = {11: [player1, player2]}
    session.updated_tournaments = []
    session.updated_stages = []
    session.updated_matches = []
    session.updated_players = []
    session.created_matches = []
    session.credits = []

    monkeypatch.setattr("infrastructure.scheduler.tournament_scheduler.TournamentRepositoryImpl", FakeTournamentRepository)
    monkeypatch.setattr("infrastructure.scheduler.tournament_scheduler.TournamentStageRepositoryImpl", FakeTournamentStageRepository)
    monkeypatch.setattr("infrastructure.scheduler.tournament_scheduler.TournamentMatchRepositoryImpl", FakeTournamentMatchRepository)
    monkeypatch.setattr("infrastructure.scheduler.tournament_scheduler.TournamentPlayersRepositoryImpl", FakeTournamentPlayersRepository)
    monkeypatch.setattr("infrastructure.scheduler.tournament_scheduler.UserRepositoryImpl", FakeUserRepository)

    scheduler = TournamentSchedulerImpl(session_factory=lambda: session)
    await scheduler.process_tournaments(as_of=datetime.now(UTC))

    assert len(session.updated_stages) == 1
    assert session.updated_stages[0].is_completed is True
    assert session.updated_stages[0].is_active is False
    assert len(session.updated_matches) == 1
    assert session.updated_matches[0].winner_id == 2
    assert session.updated_matches[0].loser_id == 1
    assert session.credits == [(4, 400)]
    assert len(session.updated_tournaments) == 1
    assert session.updated_tournaments[0].status == TournamentStatus.COMPLETED
    assert session.updated_tournaments[0].winner_id == 4


def test_celery_beat_registers_tournament_scheduler_cron():
    schedule = celery_app.conf.beat_schedule.get("process-tournaments-scheduler")
    assert schedule is not None
    assert schedule["task"] == "infrastructure.celery.tasks.process_tournaments_scheduler"


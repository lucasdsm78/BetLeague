from datetime import UTC, datetime, timedelta

import pytest

from application.tournament.process_due_tournament_usecase import ProcessDueTournamentUseCaseImpl
from application.tournament.process_tournament_scheduler_usecase import ProcessTournamentSchedulerUseCaseImpl
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


def build_tournament(tournament_id: int, *, prize_pool: float = 20.0) -> Tournament:
    now = datetime.now(UTC)
    return Tournament(
        id=tournament_id,
        uuid=f"tournament-{tournament_id}",
        name=f"Tournament {tournament_id}",
        status=TournamentStatus.IN_PROGRESS,
        max_players=16,
        min_players=2,
        current_players=2,
        entry_fee=5,
        prize_pool=prize_pool,
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

    async def find_by_id_for_update(self, tournament_id: int):
        return self.session.tournaments_by_id.get(tournament_id)

    async def update(self, tournament: Tournament):
        self.session.updated_tournaments.append(tournament)


class FakeTournamentStageRepository:
    def __init__(self, session):
        self.session = session

    async def find_due_active_stage_for_update(self, tournament_id: int, as_of: datetime):
        return self.session.active_stage_by_tournament.get(tournament_id)

    async def find_next_stage(self, tournament_id: int, current_stage: TournamentStage):
        return self.session.next_stage_by_tournament.get(tournament_id)

    async def update_stage(self, stage: TournamentStage):
        self.session.updated_stages.append(stage)


class FakeTournamentMatchRepository:
    def __init__(self, session):
        self.session = session

    async def find_matches_by_stage_id(self, stage_id: int):
        return self.session.matches_by_stage.get(stage_id, [])

    async def update(self, match):
        self.session.updated_matches.append(match)

    async def add_match(self, match):
        self.session.created_matches.append(match)


class FakeTournamentPlayersRepository:
    def __init__(self, session):
        self.session = session

    async def find_qualified_players_by_stage(self, tournament_id: int, stage: StageType):
        return self.session.players_by_stage.get((tournament_id, stage), [])

    async def update(self, player):
        self.session.updated_players.append(player)


class FakeUserRepository:
    def __init__(self, session):
        self.session = session

    async def credit_btl(self, user_id: int, amount: float):
        self.session.credits.append((user_id, amount))


class FakeDueTournamentUseCase:
    def __init__(self):
        self.calls: list[tuple[int, datetime]] = []

    async def process_tournament(self, tournament_id: int, as_of: datetime | None = None):
        self.calls.append((tournament_id, as_of))


class FakeSchedulerUseCase:
    def __init__(self):
        self.calls: list[datetime] = []

    async def process_tournaments(self, as_of: datetime | None = None):
        self.calls.append(as_of)


@pytest.mark.asyncio
async def test_tournament_scheduler_delegates_to_application_usecase():
    usecase = FakeSchedulerUseCase()
    scheduler = TournamentSchedulerImpl(session_factory=lambda: FakeSession(), usecase=usecase)
    run_at = datetime.now(UTC)

    await scheduler.process_tournaments(as_of=run_at)

    assert usecase.calls == [run_at]


@pytest.mark.asyncio
async def test_process_tournament_scheduler_loads_due_ids_and_processes_each_once(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()
    due_usecase = FakeDueTournamentUseCase()

    class FakeTournamentRepositoryForBatch:
        def __init__(self, session):
            self.session = session

        async def find_due_tournament_ids(self, as_of: datetime):
            self.session.loaded_as_of = as_of
            return [10, 11, 12]

    monkeypatch.setattr(
        "application.tournament.process_tournament_scheduler_usecase.TournamentRepositoryImpl",
        FakeTournamentRepositoryForBatch,
    )

    usecase = ProcessTournamentSchedulerUseCaseImpl(
        session_factory=lambda: session,
        process_due_tournament_usecase=due_usecase,
    )
    run_at = datetime.now(UTC)

    await usecase.process_tournaments(as_of=run_at)

    assert session.loaded_as_of == run_at
    assert due_usecase.calls == [(10, run_at), (11, run_at), (12, run_at)]


@pytest.mark.asyncio
async def test_process_due_tournament_final_stage_credits_prize_pool(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()
    tournament = build_tournament(11, prize_pool=20.0)
    stage = build_stage(tournament_id=11, stage_id=110, stage_type=StageType.FINAL, end_delta_minutes=-30)
    player1 = TournamentPlayer(id=1, user_id=3, tournament_id=11, nb_btl=50, current_stage=StageType.FINAL)
    player2 = TournamentPlayer(id=2, user_id=4, tournament_id=11, nb_btl=140, current_stage=StageType.FINAL)
    match = type("Match", (), {"id": 501, "stage_id": 110, "winner_id": None, "loser_id": None, "player1_id": 1, "player2_id": 2})()

    session.tournaments_by_id = {11: tournament}
    session.active_stage_by_tournament = {11: stage}
    session.next_stage_by_tournament = {11: None}
    session.matches_by_stage = {110: [match]}
    session.players_by_stage = {(11, StageType.FINAL): [player1, player2]}
    session.updated_tournaments = []
    session.updated_stages = []
    session.updated_matches = []
    session.updated_players = []
    session.created_matches = []
    session.credits = []

    monkeypatch.setattr(
        "application.tournament.process_due_tournament_usecase.TournamentRepositoryImpl",
        FakeTournamentRepository,
    )
    monkeypatch.setattr(
        "application.tournament.process_due_tournament_usecase.TournamentStageRepositoryImpl",
        FakeTournamentStageRepository,
    )
    monkeypatch.setattr(
        "application.tournament.process_due_tournament_usecase.TournamentMatchRepositoryImpl",
        FakeTournamentMatchRepository,
    )
    monkeypatch.setattr(
        "application.tournament.process_due_tournament_usecase.TournamentPlayersRepositoryImpl",
        FakeTournamentPlayersRepository,
    )
    monkeypatch.setattr(
        "application.tournament.process_due_tournament_usecase.UserRepositoryImpl",
        FakeUserRepository,
    )

    usecase = ProcessDueTournamentUseCaseImpl(session_factory=lambda: session)
    await usecase.process_tournament(11, as_of=datetime.now(UTC))

    assert len(session.updated_stages) == 1
    assert session.updated_stages[0].is_completed is True
    assert session.updated_stages[0].is_active is False
    assert len(session.updated_matches) == 1
    assert session.updated_matches[0].winner_id == 2
    assert session.updated_matches[0].loser_id == 1
    assert session.credits == [(4, 20.0)]
    assert len(session.updated_tournaments) == 1
    assert session.updated_tournaments[0].status == TournamentStatus.COMPLETED
    assert session.updated_tournaments[0].winner_id == 4


def test_celery_beat_registers_tournament_scheduler_cron():
    schedule = celery_app.conf.beat_schedule.get("process-tournaments-scheduler")
    assert schedule is not None
    assert schedule["task"] == "infrastructure.celery.tasks.process_tournaments_scheduler"


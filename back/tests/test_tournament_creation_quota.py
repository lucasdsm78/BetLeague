import asyncio
from types import SimpleNamespace

import pytest

import application.tournament.tournament_command_usecase as tournament_command_usecase_module
from application.tournament.tournament_command_model import TournamentCreateModel
from application.tournament.tournament_command_usecase import TournamentCommandUseCaseImpl
from application.tournament.tournament_query_usecase import TournamentQueryUseCaseImpl
from domain.tournament.exception.tournament_exception import TournamentMonthlyFreeCreationLimitReachedError
from domain.tournament.model.tournament import Tournament
from domain.tournament.model.tournament_status import TournamentStatus
from domain.tournament.service.tournament_creation_policy import TournamentCreationPolicy
from domain.user.model.email import Email
from domain.user.model.password import Password
from domain.user.model.user import User
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


class FakeUserRepository:
    def __init__(self, session: FakeSession):
        self.session = session

    async def find_by_email(self, email: str):
        user = getattr(self.session, "user", None)
        if user and user.email.value == email:
            return user
        return None

    async def find_by_id(self, user_id: int):
        user = getattr(self.session, "user", None)
        if user and user.id == user_id:
            return user
        return None


class FakeTournamentRepository:
    def __init__(self, session: FakeSession):
        self.session = session

    async def count_created_by_user_between(self, user_id: int, created_from_ms: int, created_to_ms: int) -> int:
        return getattr(self.session, "monthly_used", 0)

    async def find_by_name(self, tournament_name: str):
        return None

    async def create(self, tournament: Tournament):
        self.session.created_tournament = tournament

    async def find_by_uuid(self, uuid: str):
        created = getattr(self.session, "created_tournament", None)
        if created is None:
            return None
        return Tournament(
            id=321,
            uuid=created.uuid,
            name=created.name,
            is_private=created.is_private,
            max_players=created.max_players,
            current_players=created.current_players,
            prize_pool=created.prize_pool,
            entry_fee=created.entry_fee,
            status=created.status,
            start_date=created.start_date,
            end_date=created.end_date,
            user=created.user,
        )

    async def update(self, tournament: Tournament):
        self.session.updated_tournament = tournament
        return tournament


class FakeTournamentPlayersRepository:
    def __init__(self, session: FakeSession):
        self.session = session
        self.added_players = []

    async def get_player(self, tournament_id: int, user_id: int):
        return None

    async def add_player(self, player):
        self.added_players.append(player)
        self.session.added_player = player
        return player


class FakeSubscription:
    def __init__(self, active: bool):
        self._active = active

    def is_active(self) -> bool:
        return self._active


class FakeTournamentSubscriptionRepository:
    def __init__(self, session: FakeSession):
        self.session = session

    async def find_active_by_user_id(self, user_id: int):
        return getattr(self.session, "subscription", None)


class FakeTournamentQueryRepository:
    def __init__(self, monthly_used: int):
        self.monthly_used = monthly_used

    async def count_created_by_user_between(self, user_id: int, created_from_ms: int, created_to_ms: int) -> int:
        return self.monthly_used


class FakeSubscriptionQueryRepository:
    def __init__(self, subscription=None):
        self.subscription = subscription

    async def find_active_by_user_id(self, user_id: int):
        return self.subscription


def make_user() -> User:
    return User(
        id=42,
        email=Email("player@example.com"),
        pseudo="player",
        uuid="user-uuid",
        password=Password("hashed::secret"),
        is_tournament_subscriber=False,
    )


def make_create_model() -> TournamentCreateModel:
    return TournamentCreateModel(name="Tournoi du mois", is_private=False, max_players=16)


@pytest.mark.asyncio
async def test_create_tournament_blocks_after_two_free_tournaments_without_subscription(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()
    session.user = make_user()
    session.monthly_used = 2
    session.subscription = None

    monkeypatch.setattr(tournament_command_usecase_module, "UserRepositoryImpl", FakeUserRepository)
    monkeypatch.setattr(tournament_command_usecase_module, "TournamentRepositoryImpl", FakeTournamentRepository)
    monkeypatch.setattr(tournament_command_usecase_module, "TournamentPlayersRepositoryImpl", FakeTournamentPlayersRepository)
    monkeypatch.setattr(tournament_command_usecase_module, "TournamentSubscriptionRepositoryImpl", FakeTournamentSubscriptionRepository)

    usecase = TournamentCommandUseCaseImpl(session_factory=lambda: session, creation_policy=TournamentCreationPolicy())

    with pytest.raises(TournamentMonthlyFreeCreationLimitReachedError) as exc:
        await usecase.create_tournament(make_create_model(), "player@example.com")

    assert exc.value.monthly_free_limit == 2
    assert exc.value.monthly_free_used == 2
    assert getattr(session, "created_tournament", None) is None


@pytest.mark.asyncio
async def test_create_tournament_allows_active_subscriber_beyond_free_limit(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()
    session.user = make_user()
    session.monthly_used = 2
    session.subscription = FakeSubscription(active=True)

    monkeypatch.setattr(tournament_command_usecase_module, "UserRepositoryImpl", FakeUserRepository)
    monkeypatch.setattr(tournament_command_usecase_module, "TournamentRepositoryImpl", FakeTournamentRepository)
    monkeypatch.setattr(tournament_command_usecase_module, "TournamentPlayersRepositoryImpl", FakeTournamentPlayersRepository)
    monkeypatch.setattr(tournament_command_usecase_module, "TournamentSubscriptionRepositoryImpl", FakeTournamentSubscriptionRepository)

    usecase = TournamentCommandUseCaseImpl(session_factory=lambda: session, creation_policy=TournamentCreationPolicy())

    response = await usecase.create_tournament(make_create_model(), "player@example.com")

    assert response.tournament_id == 321
    assert response.monthly_free_tournaments_limit == 2
    assert response.monthly_free_tournaments_used == 3
    assert response.monthly_free_tournaments_remaining == 0
    assert response.can_create_tournament is True
    assert response.requires_tournament_subscription is False


@pytest.mark.asyncio
async def test_query_usecase_reports_remaining_quota_for_non_subscriber():
    user = make_user()
    query_usecase = TournamentQueryUseCaseImpl(
        session_factory=lambda: FakeSession(),
        tournament_repository=FakeTournamentQueryRepository(monthly_used=1),
        tournament_stage_repository=SimpleNamespace(),
        user_repository=SimpleNamespace(find_by_email=lambda email: asyncio.sleep(0, result=user)),
        stage_repository=SimpleNamespace(),
        tournament_match_repository=SimpleNamespace(),
        tournament_subscription_repository=FakeSubscriptionQueryRepository(subscription=None),
        invitation_repository=SimpleNamespace(),
        creation_policy=TournamentCreationPolicy(),
    )

    result = await query_usecase.get_tournament_creation_access("player@example.com")

    assert result.monthly_free_tournaments_limit == 2
    assert result.monthly_free_tournaments_used == 1
    assert result.monthly_free_tournaments_remaining == 1
    assert result.has_active_subscription is False
    assert result.can_create_tournament is True
    assert result.requires_tournament_subscription is False


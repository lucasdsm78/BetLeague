import pytest

from application.tournament_subscription.cancel.cancel_tournament_subscription_usecase import (
    CancelTournamentSubscriptionUseCaseImpl,
)
from domain.tournament_subscription.model.tournament_subscription import TournamentSubscription
from domain.tournament_subscription.model.tournament_subscription_plan import TournamentSubscriptionPlan
from domain.tournament_subscription.model.tournament_subscription_price import TournamentSubscriptionPrice
from domain.tournament_subscription.model.tournament_subscription_status import TournamentSubscriptionStatus
from domain.tournament_subscription.exception.tournament_subscription_exception import TournamentSubscriptionInactiveError
from domain.user.exception.user_exception import UserNotFoundError
from domain.user.model.email import Email
from domain.user.model.password import Password
from domain.user.model.user import User
from domain.user.model.user_summary import UserSummary


class FakeStripeService:
    def __init__(self):
        self.scheduled_subscription_ids: list[str] = []

    async def schedule_tournament_subscription_cancellation_at_period_end(self, subscription_id: str) -> dict:
        self.scheduled_subscription_ids.append(subscription_id)
        return {"id": subscription_id, "cancel_at_period_end": True}


class FakeUserRepository:
    def __init__(self, user: User | None):
        self.user = user
        self.updated_user: User | None = None

    async def find_by_email(self, email: str):
        if self.user and self.user.email.value == email:
            return self.user
        return None

    async def update(self, user: User):
        self.updated_user = user


class FakeTournamentSubscriptionRepository:
    def __init__(self, subscription: TournamentSubscription | None):
        self.subscription = subscription
        self.updated_subscription: TournamentSubscription | None = None

    async def find_active_by_user_id(self, user_id: int):
        if self.subscription and self.subscription.user.id == user_id:
            return self.subscription
        return None

    async def update(self, subscription: TournamentSubscription):
        self.updated_subscription = subscription


class FakeTournamentSubscriptionUnitOfWork:
    def __init__(self, *, user: User | None, subscription: TournamentSubscription | None):
        self.user_repo = FakeUserRepository(user)
        self.tournament_subscription_repo = FakeTournamentSubscriptionRepository(subscription)
        self.committed = False

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        return False

    async def commit(self):
        self.committed = True


def make_user(*, is_tournament_subscriber: bool = True) -> User:
    return User(
        id=42,
        uuid="user-42",
        email=Email("subscriber@example.com"),
        pseudo="subscriber",
        password=Password("hashed::secret"),
        nb_btl=100.0,
        nb_win=3,
        nb_lose=1,
        is_tournament_subscriber=is_tournament_subscriber,
    )


def make_subscription(user: User) -> TournamentSubscription:
    return TournamentSubscription(
        id=5,
        uuid="sub-uuid",
        user=UserSummary(id=user.id, email=user.email, pseudo=user.pseudo),
        plan=TournamentSubscriptionPlan.MONTHLY,
        price=TournamentSubscriptionPrice(amount=4.99),
        status=TournamentSubscriptionStatus.ACTIVE,
        current_period_start=1_700_000_000_000,
        current_period_end=4_100_000_000_000,
        stripe_subscription_id="stripe_sub_123",
    )


@pytest.mark.asyncio
async def test_cancel_tournament_subscription_updates_subscription_and_user_state():
    user = make_user()
    subscription = make_subscription(user)
    uow = FakeTournamentSubscriptionUnitOfWork(user=user, subscription=subscription)
    stripe_service = FakeStripeService()
    usecase = CancelTournamentSubscriptionUseCaseImpl(
        stripe_service=stripe_service,
        uow_factory=lambda: uow,
    )

    response = await usecase.execute(user.email.value)

    assert response.success is True
    assert "fin de la période" in response.message.lower()
    assert response.cancel_at_period_end is True
    assert response.current_period_end == subscription.current_period_end
    assert response.has_tournament_access is True
    assert stripe_service.scheduled_subscription_ids == ["stripe_sub_123"]
    assert uow.tournament_subscription_repo.updated_subscription is subscription
    assert subscription.status == TournamentSubscriptionStatus.ACTIVE
    assert subscription.cancel_at_period_end is True
    assert subscription.cancellation_requested_at is not None
    assert uow.user_repo.updated_user is None
    assert user.is_tournament_subscriber is True
    assert uow.committed is True


@pytest.mark.asyncio
async def test_cancel_tournament_subscription_requires_existing_user():
    stripe_service = FakeStripeService()
    uow = FakeTournamentSubscriptionUnitOfWork(user=None, subscription=None)
    usecase = CancelTournamentSubscriptionUseCaseImpl(
        stripe_service=stripe_service,
        uow_factory=lambda: uow,
    )

    with pytest.raises(UserNotFoundError):
        await usecase.execute("missing@example.com")

    assert stripe_service.scheduled_subscription_ids == []
    assert uow.committed is False


@pytest.mark.asyncio
async def test_cancel_tournament_subscription_requires_active_subscription():
    user = make_user()
    stripe_service = FakeStripeService()
    uow = FakeTournamentSubscriptionUnitOfWork(user=user, subscription=None)
    usecase = CancelTournamentSubscriptionUseCaseImpl(
        stripe_service=stripe_service,
        uow_factory=lambda: uow,
    )

    with pytest.raises(TournamentSubscriptionInactiveError):
        await usecase.execute(user.email.value)

    assert stripe_service.scheduled_subscription_ids == []
    assert uow.committed is False


@pytest.mark.asyncio
async def test_cancel_tournament_subscription_is_idempotent_when_already_scheduled():
    user = make_user()
    subscription = make_subscription(user)
    subscription.schedule_cancellation_at_period_end(requested_at=1_750_000_000_000)
    uow = FakeTournamentSubscriptionUnitOfWork(user=user, subscription=subscription)
    stripe_service = FakeStripeService()
    usecase = CancelTournamentSubscriptionUseCaseImpl(
        stripe_service=stripe_service,
        uow_factory=lambda: uow,
    )

    response = await usecase.execute(user.email.value)

    assert response.success is True
    assert "déjà planifiée" in response.message.lower()
    assert response.cancel_at_period_end is True
    assert stripe_service.scheduled_subscription_ids == []
    assert uow.committed is False




import pytest

from application.tournament_subscription.webhook.process_stripe_webhook import (
    ProcessStripeWebhookTournamentSubscriptionUseCaseImpl,
)
from domain.tournament_subscription.exception.tournament_subscription_exception import TournamentSubscriptionNotFoundError
from domain.tournament_subscription.model.tournament_subscription import TournamentSubscription
from domain.tournament_subscription.model.tournament_subscription_plan import TournamentSubscriptionPlan
from domain.tournament_subscription.model.tournament_subscription_price import TournamentSubscriptionPrice
from domain.tournament_subscription.model.tournament_subscription_status import TournamentSubscriptionStatus
from domain.user.model.email import Email
from domain.user.model.password import Password
from domain.user.model.user import User
from domain.user.model.user_summary import UserSummary


def make_user() -> User:
    return User(
        id=42,
        uuid='user-42',
        email=Email('subscriber@example.com'),
        pseudo='subscriber',
        password=Password('hashed::secret'),
        nb_btl=100.0,
        nb_win=3,
        nb_lose=1,
        is_tournament_subscriber=True,
    )


def make_subscription(user: User) -> TournamentSubscription:
    return TournamentSubscription(
        id=5,
        uuid='sub-uuid',
        user=UserSummary(id=user.id, email=user.email, pseudo=user.pseudo),
        plan=TournamentSubscriptionPlan.MONTHLY,
        price=TournamentSubscriptionPrice(amount=4.99),
        status=TournamentSubscriptionStatus.ACTIVE,
        current_period_start=1_700_000_000_000,
        current_period_end=1_800_000_000_000,
        stripe_subscription_id='stripe_sub_123',
    )


def make_incomplete_subscription(user: User) -> TournamentSubscription:
    return TournamentSubscription(
        id=5,
        uuid='sub-uuid',
        user=UserSummary(id=user.id, email=user.email, pseudo=user.pseudo),
        plan=TournamentSubscriptionPlan.MONTHLY,
        price=TournamentSubscriptionPrice(amount=4.99),
        status=TournamentSubscriptionStatus.INCOMPLETE,
        stripe_subscription_id=None,
    )


class FakeUserRepository:
    def __init__(self, user: User | None):
        self.user = user
        self.updated_user: User | None = None

    async def find_by_id(self, user_id: int):
        if self.user and self.user.id == user_id:
            return self.user
        return None

    async def update(self, user: User):
        self.updated_user = user


class FakeTournamentSubscriptionRepository:
    def __init__(self, subscription: TournamentSubscription | None):
        self.subscription = subscription
        self.updated_subscription: TournamentSubscription | None = None

    async def find_by_uuid(self, uuid: str):
        if self.subscription and self.subscription.uuid == uuid:
            return self.subscription
        raise TournamentSubscriptionNotFoundError

    async def find_by_stripe_subscription_id(self, stripe_id: str):
        if self.subscription and self.subscription.stripe_subscription_id == stripe_id:
            return self.subscription
        raise TournamentSubscriptionNotFoundError

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


class FakeStripeService:
    def __init__(self, *, checkout_sessions: dict | None = None, subscriptions: dict | None = None):
        self.checkout_sessions = checkout_sessions or {}
        self.subscriptions = subscriptions or {}

    async def retrieve_checkout_session(self, session_id: str):
        value = self.checkout_sessions.get(session_id)
        if value is None:
            raise ValueError("checkout session introuvable")
        return value

    async def retrieve_subscription(self, subscription_id: str):
        value = self.subscriptions.get(subscription_id)
        if value is None:
            raise ValueError("subscription introuvable")
        return value


class StripeLikeObject:
    def __init__(self, data: dict):
        self._data = data

    def to_dict_recursive(self):
        return self._data


@pytest.mark.asyncio
async def test_webhook_updated_marks_subscription_as_scheduled_for_end_of_period():
    user = make_user()
    subscription = make_subscription(user)
    uow = FakeTournamentSubscriptionUnitOfWork(user=user, subscription=subscription)
    usecase = ProcessStripeWebhookTournamentSubscriptionUseCaseImpl(uow_factory=lambda: uow)

    await usecase.execute('customer.subscription.updated', {
        'id': 'stripe_sub_123',
        'status': 'active',
        'current_period_start': 1_700_000_000,
        'current_period_end': 1_800_000_000,
        'cancel_at_period_end': True,
    })

    assert uow.committed is True
    assert subscription.cancel_at_period_end is True
    assert subscription.current_period_end == 1_800_000_000_000
    assert uow.tournament_subscription_repo.updated_subscription is subscription


@pytest.mark.asyncio
async def test_webhook_deleted_revokes_access_and_cancels_subscription():
    user = make_user()
    subscription = make_subscription(user)
    subscription.schedule_cancellation_at_period_end(requested_at=1_750_000_000_000)
    uow = FakeTournamentSubscriptionUnitOfWork(user=user, subscription=subscription)
    usecase = ProcessStripeWebhookTournamentSubscriptionUseCaseImpl(uow_factory=lambda: uow)

    await usecase.execute('customer.subscription.deleted', {
        'id': 'stripe_sub_123',
    })

    assert uow.committed is True
    assert subscription.status == TournamentSubscriptionStatus.CANCELLED
    assert subscription.cancel_at_period_end is False
    assert uow.user_repo.updated_user is user
    assert user.is_tournament_subscriber is False


@pytest.mark.asyncio
async def test_webhook_payment_succeeded_accepts_stripe_like_objects_without_dict_get():
    user = make_user()
    subscription = make_subscription(user)
    uow = FakeTournamentSubscriptionUnitOfWork(user=user, subscription=subscription)
    usecase = ProcessStripeWebhookTournamentSubscriptionUseCaseImpl(uow_factory=lambda: uow)

    payload = StripeLikeObject({
        'parent': {
            'type': 'subscription_details',
            'subscription_details': {
                'subscription': 'stripe_sub_123',
            },
        },
        'lines': {
            'data': [{
                'period': {
                    'start': 1_700_000_000,
                    'end': 1_800_000_000,
                },
            }],
        },
    })

    await usecase.execute('invoice.payment_succeeded', payload)

    assert uow.committed is True
    assert subscription.status == TournamentSubscriptionStatus.ACTIVE
    assert subscription.current_period_start == 1_700_000_000_000
    assert subscription.current_period_end == 1_800_000_000_000
    assert uow.user_repo.updated_user is user
    assert user.is_tournament_subscriber is True


@pytest.mark.asyncio
async def test_webhook_checkout_completed_fetches_session_from_stripe_when_subscription_missing_in_payload():
    user = make_user()
    subscription = make_incomplete_subscription(user)
    uow = FakeTournamentSubscriptionUnitOfWork(user=user, subscription=subscription)
    stripe_service = FakeStripeService(checkout_sessions={
        'cs_test_123': {
            'id': 'cs_test_123',
            'mode': 'subscription',
            'client_reference_id': 'sub-uuid',
            'subscription': 'stripe_sub_456',
        },
    })
    usecase = ProcessStripeWebhookTournamentSubscriptionUseCaseImpl(
        uow_factory=lambda: uow,
        stripe_service=stripe_service,
    )

    await usecase.execute('checkout.session.completed', {
        'id': 'cs_test_123',
        'mode': 'subscription',
        'client_reference_id': 'sub-uuid',
        'subscription': None,
    })

    assert uow.committed is True
    assert subscription.stripe_subscription_id == 'stripe_sub_456'
    assert uow.tournament_subscription_repo.updated_subscription is subscription


@pytest.mark.asyncio
async def test_webhook_subscription_created_fetches_full_subscription_from_stripe_when_payload_missing_metadata():
    user = make_user()
    subscription = make_incomplete_subscription(user)
    uow = FakeTournamentSubscriptionUnitOfWork(user=user, subscription=subscription)
    stripe_service = FakeStripeService(subscriptions={
        'stripe_sub_456': {
            'id': 'stripe_sub_456',
            'status': 'active',
            'metadata': {'uuid': 'sub-uuid'},
            'current_period_start': 1_700_000_000,
            'current_period_end': 1_800_000_000,
            'cancel_at_period_end': False,
        },
    })
    usecase = ProcessStripeWebhookTournamentSubscriptionUseCaseImpl(
        uow_factory=lambda: uow,
        stripe_service=stripe_service,
    )

    await usecase.execute('customer.subscription.created', {
        'id': 'stripe_sub_456',
    })

    assert uow.committed is True
    assert subscription.stripe_subscription_id == 'stripe_sub_456'
    assert subscription.status == TournamentSubscriptionStatus.ACTIVE
    assert subscription.current_period_start == 1_700_000_000_000
    assert subscription.current_period_end == 1_800_000_000_000
    assert user.is_tournament_subscriber is True


@pytest.mark.asyncio
async def test_webhook_payment_succeeded_fetches_subscription_periods_when_invoice_lines_are_missing():
    user = make_user()
    subscription = make_subscription(user)
    uow = FakeTournamentSubscriptionUnitOfWork(user=user, subscription=subscription)
    stripe_service = FakeStripeService(subscriptions={
        'stripe_sub_123': {
            'id': 'stripe_sub_123',
            'status': 'active',
            'metadata': {'uuid': 'sub-uuid'},
            'current_period_start': 1_710_000_000,
            'current_period_end': 1_810_000_000,
        },
    })
    usecase = ProcessStripeWebhookTournamentSubscriptionUseCaseImpl(
        uow_factory=lambda: uow,
        stripe_service=stripe_service,
    )

    await usecase.execute('invoice.payment_succeeded', {
        'subscription': 'stripe_sub_123',
    })

    assert uow.committed is True
    assert subscription.status == TournamentSubscriptionStatus.ACTIVE
    assert subscription.current_period_start == 1_710_000_000_000
    assert subscription.current_period_end == 1_810_000_000_000


@pytest.mark.asyncio
async def test_webhook_checkout_completed_links_local_subscription_to_stripe_subscription_id():
    user = make_user()
    subscription = make_incomplete_subscription(user)
    uow = FakeTournamentSubscriptionUnitOfWork(user=user, subscription=subscription)
    usecase = ProcessStripeWebhookTournamentSubscriptionUseCaseImpl(uow_factory=lambda: uow)

    await usecase.execute('checkout.session.completed', {
        'mode': 'subscription',
        'client_reference_id': 'sub-uuid',
        'subscription': 'stripe_sub_456',
    })

    assert uow.committed is True
    assert subscription.stripe_subscription_id == 'stripe_sub_456'
    assert uow.tournament_subscription_repo.updated_subscription is subscription


@pytest.mark.asyncio
async def test_webhook_payment_succeeded_uses_top_level_subscription_field_after_checkout_completed_link():
    user = make_user()
    subscription = make_incomplete_subscription(user)
    uow = FakeTournamentSubscriptionUnitOfWork(user=user, subscription=subscription)
    usecase = ProcessStripeWebhookTournamentSubscriptionUseCaseImpl(uow_factory=lambda: uow)

    await usecase.execute('checkout.session.completed', {
        'mode': 'subscription',
        'client_reference_id': 'sub-uuid',
        'subscription': 'stripe_sub_456',
    })

    await usecase.execute('invoice.payment_succeeded', {
        'subscription': 'stripe_sub_456',
        'lines': {
            'data': [{
                'period': {
                    'start': 1_700_000_000,
                    'end': 1_800_000_000,
                },
            }],
        },
    })

    assert subscription.status == TournamentSubscriptionStatus.ACTIVE
    assert subscription.current_period_start == 1_700_000_000_000
    assert subscription.current_period_end == 1_800_000_000_000
    assert user.is_tournament_subscriber is True





from types import SimpleNamespace

import pytest

import application.tournament_subscription.create.create_tournament_subscription_usecase as create_usecase_module
from application.tournament_subscription.create.create_tournament_subscription_usecase import (
    CreateTournamentSubscriptionUseCaseImpl,
)
from application.tournament_subscription.query_tournament_subscription_usecase import (
    TournamentSubscriptionQueryUseCaseImpl,
)
from application.tournament_subscription.tournament_subscription_command_model import CreateSubscriptionRequest
from domain.user.model.email import Email


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
        return SimpleNamespace(id=42, email=Email(email), pseudo='player')


class FakeTournamentSubscriptionRepository:
    def __init__(self, session):
        self.session = session

    async def create(self, subscription):
        self.session.created_subscription = subscription


class FakeDomainService:
    async def create_tournament_subscription(self, user_id: int, tournament_subscription_plan):
        return SimpleNamespace(
            uuid='sub-uuid',
            user=SimpleNamespace(id=user_id),
            plan=tournament_subscription_plan,
            update_stripe_subscription_id_from_stripe=lambda stripe_id: None,
        )


class FakeStripeService:
    def __init__(self):
        self.calls = []

    async def create_subscription_session(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(url='https://checkout.stripe.test/session', subscription='stripe_sub_123')


@pytest.mark.asyncio
async def test_query_usecase_returns_monthly_and_yearly_plans():
    result = await TournamentSubscriptionQueryUseCaseImpl().get_available_plans()

    assert [plan.id for plan in result.plans] == ['monthly', 'yearly']
    assert result.plans[1].is_recommended is True
    assert result.yearly_savings_cents == 2989
    assert result.yearly_discount_percent == 50


@pytest.mark.asyncio
async def test_create_usecase_builds_server_side_urls_and_supports_yearly_plan(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()
    stripe_service = FakeStripeService()

    monkeypatch.setattr(create_usecase_module, 'UserRepositoryImpl', FakeUserRepository)
    monkeypatch.setattr(create_usecase_module, 'TournamentSubscriptionRepositoryImpl', FakeTournamentSubscriptionRepository)

    usecase = CreateTournamentSubscriptionUseCaseImpl(
        session_factory=lambda: session,
        stripe_service=stripe_service,
        domain_service=FakeDomainService(),
        settings=SimpleNamespace(app_frontend_url='https://betleague.app'),
    )

    response = await usecase.execute(
        'player@example.com',
        CreateSubscriptionRequest(subscription_plan='yearly'),
    )

    assert response.checkout_url == 'https://checkout.stripe.test/session'
    assert stripe_service.calls == [{
        'uuid': 'sub-uuid',
        'customer_email': 'player@example.com',
        'price_data': {
            'currency': 'eur',
            'unit_amount': 2999,
            'recurring': {'interval': 'year'},
            'product_data': {'name': 'Abonnement tournois BetLeague'},
        },
        'success_url': 'https://betleague.app/shop?subscription=success',
        'cancel_url': 'https://betleague.app/shop?subscription=cancelled',
        'metadata': {
            'uuid': 'sub-uuid',
            'user_id': 42,
            'subscription_plan': 'yearly',
        },
    }]

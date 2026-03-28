from abc import ABC, abstractmethod
from typing import Callable

from sqlalchemy.ext.asyncio.session import AsyncSession

from application.tournament_subscription.tournament_subscription_command_model import CheckoutSessionResponse, \
    CreateSubscriptionRequest
from domain.services.stripe.stripe_service import StripeService
from domain.tournament_subscription.model.tournament_subscription_plan import TournamentSubscriptionPlan
from domain.tournament_subscription.service.tournament_subscription_domain_service import SubscriptionDomainService
from domain.tournament_subscription.service.tournament_subscription_pricing_service import \
    TournamentSubscriptionPricingService
from domain.user.exception.user_exception import UserNotFoundError
from infrastructure.config import Settings
from infrastructure.postgresql.tournament_subscription.tournament_subscription_repository import \
    TournamentSubscriptionRepositoryImpl
from infrastructure.postgresql.user.user_repository import UserRepositoryImpl


class CreateTournamentSubscriptionUseCase(ABC):

    @abstractmethod
    async def execute(self, email: str, request: CreateSubscriptionRequest) -> CheckoutSessionResponse:
        raise NotImplementedError


class CreateTournamentSubscriptionUseCaseImpl(CreateTournamentSubscriptionUseCase):
    def __init__(
            self,
            session_factory: Callable[[], AsyncSession],
            stripe_service: StripeService,
            domain_service: SubscriptionDomainService,
            settings: Settings,
    ):
        self._session_factory = session_factory
        self._stripe_service = stripe_service
        self._domain_service = domain_service
        self._settings = settings

    def _build_frontend_url(self, status_value: str) -> str:
        base_url = self._settings.app_frontend_url.rstrip("/")
        return f"{base_url}/shop?subscription={status_value}"

    async def execute(self, email: str, request: CreateSubscriptionRequest) -> CheckoutSessionResponse:
        async with self._session_factory() as session:
            async with session.begin():
                user_repository = UserRepositoryImpl(session=session)
                tournament_subscription_repository = TournamentSubscriptionRepositoryImpl(session=session)
                user = await user_repository.find_by_email(email)
                if not user:
                    raise UserNotFoundError

                subscription_type = TournamentSubscriptionPlan(request.subscription_plan)

                subscription = await self._domain_service.create_tournament_subscription(user.id, subscription_type)
                price_data = TournamentSubscriptionPricingService.get_stripe_price_data(subscription_type)
                session_stripe = await self._stripe_service.create_subscription_session(
                    uuid=subscription.uuid,
                    customer_email=user.email.value,
                    price_data=price_data,
                    success_url=self._build_frontend_url("success"),
                    cancel_url=self._build_frontend_url("cancelled"),
                    metadata={
                        "uuid": subscription.uuid,
                        "user_id": user.id,
                        "subscription_plan": subscription_type.value,
                    }
                )

                stripe_sub_id = session_stripe.subscription

                subscription.update_stripe_subscription_id_from_stripe(stripe_sub_id)

                await tournament_subscription_repository.create(subscription)

                return CheckoutSessionResponse(
                    checkout_url=session_stripe.url,
                )

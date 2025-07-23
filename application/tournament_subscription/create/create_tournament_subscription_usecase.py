from abc import ABC, abstractmethod
from typing import Callable
import shortuuid

from sqlalchemy.ext.asyncio.session import AsyncSession

from application.tournament_subscription.tournament_subscription_command_model import CheckoutSessionResponse, \
    CreateSubscriptionRequest
from domain.services.stripe.stripe_service import StripeService
from domain.tournament_subscription.model.tournament_subscription_plan import TournamentSubscriptionPlan
from domain.tournament_subscription.service.tournament_subscription_domain_service import SubscriptionDomainService
from domain.tournament_subscription.service.tournament_subscription_pricing_service import \
    TournamentSubscriptionPricingService
from domain.user.exception.user_exception import UserNotFoundError
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
            domain_service: SubscriptionDomainService
    ):
        self._session_factory = session_factory
        self._stripe_service = stripe_service
        self._domain_service = domain_service

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
                price_id = TournamentSubscriptionPricingService.get_stripe_price_id(subscription_type)
                session_stripe = await self._stripe_service.create_subscription_session(
                    uuid=subscription.uuid,
                    customer_email=user.email.value,
                    price_id=price_id,
                    success_url=request.success_url,
                    cancel_url=request.cancel_url,
                    metadata={
                        "uuid": subscription.uuid,
                        "user_id": user.id
                    }
                )

                stripe_sub_id = session_stripe.subscription

                subscription.update_stripe_subscription_id_from_stripe(stripe_sub_id)

                await tournament_subscription_repository.create(subscription)

                return CheckoutSessionResponse(
                    checkout_url=session_stripe.url,
                )

from abc import ABC, abstractmethod
from typing import Callable

from application.tournament_subscription.tournament_subscription_command_model import CancelSubscriptionResponse
from domain.services.stripe.stripe_service import StripeService
from domain.tournament_subscription.exception.tournament_subscription_exception import TournamentSubscriptionInactiveError
from domain.tournament_subscription.unit_of_work import TournamentSubscriptionUnitOfWork
from domain.user.exception.user_exception import UserNotFoundError


class CancelTournamentSubscriptionUseCase(ABC):

    @abstractmethod
    async def execute(self, email: str) -> CancelSubscriptionResponse:
        raise NotImplementedError


class CancelTournamentSubscriptionUseCaseImpl(CancelTournamentSubscriptionUseCase):

    def __init__(
            self,
            stripe_service: StripeService,
            uow_factory: Callable[[], TournamentSubscriptionUnitOfWork],
    ):
        self._stripe_service = stripe_service
        self._uow_factory = uow_factory

    async def execute(self, email: str) -> CancelSubscriptionResponse:
        async with self._uow_factory() as uow:
            user = await uow.user_repo.find_by_email(email)
            if not user:
                raise UserNotFoundError

            subscription = await uow.tournament_subscription_repo.find_active_by_user_id(user.id)
            if not subscription or not subscription.stripe_subscription_id:
                raise TournamentSubscriptionInactiveError

            await self._stripe_service.cancel_tournament_subscription(subscription.stripe_subscription_id)

            subscription.cancel()
            await uow.tournament_subscription_repo.update(subscription)

            user.is_tournament_subscriber = False
            await uow.user_repo.update(user)
            await uow.commit()

            return CancelSubscriptionResponse(
                success=True,
                message="Votre abonnement tournoi a bien été annulé. Vous repassez sur le quota gratuit mensuel.",
            )


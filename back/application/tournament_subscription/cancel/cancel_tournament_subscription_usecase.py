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

            if subscription.cancel_at_period_end:
                return CancelSubscriptionResponse(
                    success=True,
                    message="La résiliation de votre abonnement tournoi est déjà planifiée pour la fin de période.",
                    cancel_at_period_end=True,
                    current_period_end=subscription.current_period_end,
                    has_tournament_access=subscription.is_active(),
                )

            await self._stripe_service.schedule_tournament_subscription_cancellation_at_period_end(
                subscription.stripe_subscription_id,
            )

            subscription.schedule_cancellation_at_period_end()
            await uow.tournament_subscription_repo.update(subscription)
            await uow.commit()

            return CancelSubscriptionResponse(
                success=True,
                message="Votre abonnement tournoi sera résilié à la fin de la période en cours. Votre accès reste actif jusque-là.",
                cancel_at_period_end=True,
                current_period_end=subscription.current_period_end,
                has_tournament_access=subscription.is_active(),
            )


from abc import ABC, abstractmethod
from typing import Callable

from sqlalchemy.ext.asyncio.session import AsyncSession

from domain.services.stripe.stripe_service import StripeService
from domain.tournament.exception.tournament_exception import UserNotSubscribedError
from domain.tournament_subscription.repository.tournament_subscription_repository import \
    TournamentSubscriptionRepository
from domain.user.repository.user_repository import UserRepository
from infrastructure.postgresql.tournament_subscription.tournament_subscription_repository import \
    TournamentSubscriptionRepositoryImpl
from infrastructure.postgresql.user.user_repository import UserRepositoryImpl


class CancelTournamentSubscriptionUseCase(ABC):

    @abstractmethod
    async def execute(self, email: str) -> None:
        raise NotImplementedError


class CancelTournamentSubscriptionUseCaseImpl(CancelTournamentSubscriptionUseCase):

    def __init__(
            self,
            stripe_service: StripeService,
            session_factory: Callable[[], AsyncSession]
    ):
        self._stripe_service = stripe_service
        self._session_factory = session_factory

    async def execute(self, email: str) -> None:
        async with self._session_factory() as session:
            async with session.begin():
                user_repository = UserRepositoryImpl(session=session)
                tournament_subscription_repository = TournamentSubscriptionRepositoryImpl(session=session)

                user = await user_repository.find_by_email(email)
                if not user:
                    raise UserNotSubscribedError

                subscription = await tournament_subscription_repository.find_active_by_user_id(user.id)
                if not subscription or not subscription.stripe_subscription_id:
                    raise ValueError("Aucun abonnement actif trouvé")
                await self._stripe_service.cancel_tournament_subscription(subscription.stripe_subscription_id)

from domain.tournament_subscription.model.tournament_subscription import TournamentSubscription
from domain.tournament_subscription.model.tournament_subscription_plan import TournamentSubscriptionPlan
from domain.tournament_subscription.model.tournament_subscription_status import TournamentSubscriptionStatus
from domain.tournament_subscription.repository.tournament_subscription_repository import \
    TournamentSubscriptionRepository
from domain.tournament_subscription.service.tournament_subscription_pricing_service import \
    TournamentSubscriptionPricingService
from domain.user.model.user_summary import UserSummary
from domain.user.repository.user_repository import UserRepository
import shortuuid


class SubscriptionDomainService:
    def __init__(self, repository: TournamentSubscriptionRepository, user_repository: UserRepository):
        self._repository = repository
        self._user_repository = user_repository

    async def can_user_subscribe(self, user_id: int) -> bool:
        existing_subscription = await self._repository.find_active_by_user_id(user_id)
        return existing_subscription is None

    async def create_tournament_subscription(
            self,
            user_id: int,
            tournament_subscription_plan: TournamentSubscriptionPlan
    ) -> TournamentSubscription:
        if not await self.can_user_subscribe(user_id):
            raise ValueError("L'utilisateur a déjà un abonnement actif")

        price = TournamentSubscriptionPricingService.get_price(tournament_subscription_plan)
        user = await self._user_repository.find_by_id(user_id)

        subscription = TournamentSubscription(
            uuid = shortuuid.uuid(),
            user=UserSummary(email=user.email, id=user.id, pseudo=user.pseudo),
            plan=tournament_subscription_plan,
            price=price,
            status=TournamentSubscriptionStatus.INCOMPLETE
        )

        return subscription

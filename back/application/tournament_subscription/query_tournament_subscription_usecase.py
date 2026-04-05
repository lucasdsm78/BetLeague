from abc import ABC, abstractmethod
from decimal import Decimal, ROUND_HALF_UP

from application.tournament_subscription.tournament_subscription_query_model import (
    TournamentCurrentSubscriptionReadModel,
    TournamentSubscriptionPlanReadModel,
    TournamentSubscriptionPlansResponse,
)
from domain.tournament_subscription.model.tournament_subscription_plan import TournamentSubscriptionPlan
from domain.tournament_subscription.repository.tournament_subscription_repository import TournamentSubscriptionRepository
from domain.tournament_subscription.service.tournament_subscription_pricing_service import (
    TournamentSubscriptionPricingService,
)
from domain.user.exception.user_exception import UserNotFoundError
from domain.user.repository.user_repository import UserRepository


class TournamentSubscriptionQueryUseCase(ABC):

    @abstractmethod
    async def get_available_plans(self) -> TournamentSubscriptionPlansResponse:
        raise NotImplementedError

    @abstractmethod
    async def get_current_subscription(self, email: str) -> TournamentCurrentSubscriptionReadModel:
        raise NotImplementedError


class TournamentSubscriptionQueryUseCaseImpl(TournamentSubscriptionQueryUseCase):

    def __init__(
            self,
            user_repository: UserRepository | None = None,
            tournament_subscription_repository: TournamentSubscriptionRepository | None = None,
    ):
        self._user_repository = user_repository
        self._tournament_subscription_repository = tournament_subscription_repository

    @staticmethod
    def _to_cents(amount: Decimal) -> int:
        return int((amount * 100).quantize(Decimal("1")))

    @staticmethod
    def _to_discount_percent(savings: Decimal, monthly_annual_cost: Decimal) -> int:
        if monthly_annual_cost <= 0:
            return 0
        return int(((savings / monthly_annual_cost) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))

    @staticmethod
    def _plan_name(plan: TournamentSubscriptionPlan) -> str:
        return "Mensuel" if plan is TournamentSubscriptionPlan.MONTHLY else "Annuel"

    @staticmethod
    def _plan_interval(plan: TournamentSubscriptionPlan) -> str:
        return "month" if plan is TournamentSubscriptionPlan.MONTHLY else "year"

    async def get_available_plans(self) -> TournamentSubscriptionPlansResponse:
        plans = [
            TournamentSubscriptionPlanReadModel(
                id=plan.value,
                name=self._plan_name(plan),
                price_cents=plan.price_cents,
                currency="EUR",
                interval=self._plan_interval(plan),
                is_recommended=plan is TournamentSubscriptionPlan.YEARLY,
            )
            for plan in TournamentSubscriptionPlan
        ]

        yearly_savings = TournamentSubscriptionPricingService.calculate_yearly_savings()
        monthly_annual_cost = TournamentSubscriptionPricingService.get_price(TournamentSubscriptionPlan.MONTHLY).amount * 12

        return TournamentSubscriptionPlansResponse(
            plans=plans,
            yearly_savings_cents=self._to_cents(yearly_savings),
            yearly_discount_percent=self._to_discount_percent(yearly_savings, monthly_annual_cost),
        )

    async def get_current_subscription(self, email: str) -> TournamentCurrentSubscriptionReadModel:
        if self._user_repository is None or self._tournament_subscription_repository is None:
            raise RuntimeError("TournamentSubscriptionQueryUseCaseImpl requires repositories to load the current subscription")

        user = await self._user_repository.find_by_email(email)
        if not user:
            raise UserNotFoundError

        subscription = await self._tournament_subscription_repository.find_active_by_user_id(user.id)
        if subscription is None:
            raise ValueError("Aucun abonnement tournoi actif trouvé")

        return TournamentCurrentSubscriptionReadModel(
            plan_id=subscription.plan.value,
            plan_name=self._plan_name(subscription.plan),
            price_cents=int(Decimal(str(subscription.price.amount)) * 100),
            currency=subscription.price.currency,
            interval=self._plan_interval(subscription.plan),
            status=subscription.status.value,
            current_period_start=subscription.current_period_start,
            current_period_end=subscription.current_period_end,
            cancel_at_period_end=subscription.cancel_at_period_end,
            cancellation_requested_at=subscription.cancellation_requested_at,
            has_tournament_access=subscription.is_active(),
        )


from abc import ABC, abstractmethod
from decimal import Decimal, ROUND_HALF_UP

from application.tournament_subscription.tournament_subscription_query_model import (
    TournamentSubscriptionPlanReadModel,
    TournamentSubscriptionPlansResponse,
)
from domain.tournament_subscription.model.tournament_subscription_plan import TournamentSubscriptionPlan
from domain.tournament_subscription.service.tournament_subscription_pricing_service import (
    TournamentSubscriptionPricingService,
)


class TournamentSubscriptionQueryUseCase(ABC):

    @abstractmethod
    async def get_available_plans(self) -> TournamentSubscriptionPlansResponse:
        raise NotImplementedError


class TournamentSubscriptionQueryUseCaseImpl(TournamentSubscriptionQueryUseCase):

    @staticmethod
    def _to_cents(amount: Decimal) -> int:
        return int((amount * 100).quantize(Decimal("1")))

    @staticmethod
    def _to_discount_percent(savings: Decimal, monthly_annual_cost: Decimal) -> int:
        if monthly_annual_cost <= 0:
            return 0
        return int(((savings / monthly_annual_cost) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))

    async def get_available_plans(self) -> TournamentSubscriptionPlansResponse:
        plans = [
            TournamentSubscriptionPlanReadModel(
                id=plan.value,
                name="Mensuel" if plan is TournamentSubscriptionPlan.MONTHLY else "Annuel",
                price_cents=plan.price_cents,
                currency="EUR",
                interval="month" if plan is TournamentSubscriptionPlan.MONTHLY else "year",
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

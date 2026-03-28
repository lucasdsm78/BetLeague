from abc import ABC, abstractmethod
from decimal import Decimal

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

        return TournamentSubscriptionPlansResponse(
            plans=plans,
            yearly_savings_cents=self._to_cents(
                TournamentSubscriptionPricingService.calculate_yearly_savings()
            ),
        )


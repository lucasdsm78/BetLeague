from decimal import Decimal

from domain.tournament_subscription.model.tournament_subscription_plan import TournamentSubscriptionPlan
from domain.tournament_subscription.model.tournament_subscription_price import TournamentSubscriptionPrice


class TournamentSubscriptionPricingService:

    @staticmethod
    def get_price(subscription_plan: TournamentSubscriptionPlan) -> TournamentSubscriptionPrice:
        prices = {
            TournamentSubscriptionPlan.MONTHLY: TournamentSubscriptionPrice(Decimal("4.99")),
            TournamentSubscriptionPlan.YEARLY: TournamentSubscriptionPrice(Decimal("29.99"))
        }
        return prices[subscription_plan]

    @staticmethod
    def get_stripe_price_data(subscription_plan: TournamentSubscriptionPlan) -> dict:
        return {
            "currency": "eur",
            "unit_amount": subscription_plan.price_cents,
            "recurring": {
                "interval": "month" if subscription_plan is TournamentSubscriptionPlan.MONTHLY else "year",
            },
            "product_data": {
                "name": "Abonnement tournois BetLeague",
            },
        }

    @staticmethod
    def calculate_yearly_savings() -> Decimal:
        monthly_annual_cost = TournamentSubscriptionPricingService.get_price(TournamentSubscriptionPlan.MONTHLY).amount * 12
        yearly_cost = TournamentSubscriptionPricingService.get_price(TournamentSubscriptionPlan.YEARLY).amount
        return monthly_annual_cost - yearly_cost

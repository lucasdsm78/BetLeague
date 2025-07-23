from decimal import Decimal

from domain.tournament_subscription.model.tournament_subscription_plan import TournamentSubscriptionPlan
from domain.tournament_subscription.model.tournament_subscription_price import TournamentSubscriptionPrice


class TournamentSubscriptionPricingService:
    # Prix IDs Stripe (à créer dans votre dashboard Stripe)
    STRIPE_PRICE_IDS = {
        TournamentSubscriptionPlan.MONTHLY: "price_1234567890monthly",
        TournamentSubscriptionPlan.YEARLY: "price_1234567890yearly"
    }

    @staticmethod
    def get_price(subscription_plan: TournamentSubscriptionPlan) -> TournamentSubscriptionPrice:
        prices = {
            TournamentSubscriptionPlan.MONTHLY: TournamentSubscriptionPrice(Decimal("4.99")),
            TournamentSubscriptionPlan.YEARLY: TournamentSubscriptionPrice(Decimal("49.99"))
        }
        return prices[subscription_plan]

    @staticmethod
    def get_stripe_price_id(subscription_plan: TournamentSubscriptionPlan) -> str:
        return TournamentSubscriptionPricingService.STRIPE_PRICE_IDS[subscription_plan]

    @staticmethod
    def calculate_yearly_savings() -> Decimal:
        monthly_annual_cost = TournamentSubscriptionPricingService.get_price(TournamentSubscriptionPlan.MONTHLY).amount * 12
        yearly_cost = TournamentSubscriptionPricingService.get_price(TournamentSubscriptionPlan.YEARLY).amount
        return monthly_annual_cost - yearly_cost

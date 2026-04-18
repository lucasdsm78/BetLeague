class ShopFeatureDisabledError(Exception):
    code = "SHOP_FEATURE_DISABLED"
    message = "La boutique est temporairement indisponible."

    def __str__(self) -> str:
        return self.message


class BTLPurchaseDisabledError(ShopFeatureDisabledError):
    code = "BTL_PURCHASE_DISABLED"
    message = "L'achat de BTL est temporairement indisponible."


class TournamentSubscriptionDisabledError(ShopFeatureDisabledError):
    code = "TOURNAMENT_SUBSCRIPTION_DISABLED"
    message = "L'abonnement tournoi est temporairement indisponible."


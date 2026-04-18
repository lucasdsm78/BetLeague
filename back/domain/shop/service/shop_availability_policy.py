from __future__ import annotations

from dataclasses import dataclass

from domain.shop.exception.shop_exception import BTLPurchaseDisabledError, TournamentSubscriptionDisabledError


@dataclass(frozen=True)
class ShopAvailabilityStatus:
    shop_enabled: bool
    btl_purchase_enabled: bool
    tournament_subscription_enabled: bool


class ShopAvailabilityPolicy:
    def __init__(
        self,
        *,
        shop_enabled: bool = True,
        btl_purchase_enabled: bool = True,
        tournament_subscription_enabled: bool = True,
    ):
        self._shop_enabled = bool(shop_enabled)
        self._btl_purchase_enabled = bool(btl_purchase_enabled)
        self._tournament_subscription_enabled = bool(tournament_subscription_enabled)

    def get_status(self) -> ShopAvailabilityStatus:
        if not self._shop_enabled:
            return ShopAvailabilityStatus(
                shop_enabled=False,
                btl_purchase_enabled=False,
                tournament_subscription_enabled=False,
            )

        return ShopAvailabilityStatus(
            shop_enabled=True,
            btl_purchase_enabled=self._btl_purchase_enabled,
            tournament_subscription_enabled=self._tournament_subscription_enabled,
        )

    def ensure_btl_purchase_enabled(self) -> None:
        status = self.get_status()
        if not status.btl_purchase_enabled:
            raise BTLPurchaseDisabledError

    def ensure_tournament_subscription_enabled(self) -> None:
        status = self.get_status()
        if not status.tournament_subscription_enabled:
            raise TournamentSubscriptionDisabledError


from abc import ABC, abstractmethod
from typing import Any
import stripe
from domain.purchase.model.purchase import Purchase
from domain.tournament_subscription.model.tournament_subscription import TournamentSubscription


class StripeService(ABC):

    @abstractmethod
    async def create_payment_intent(self, purchase: Purchase) -> stripe.checkout.Session:
        raise NotImplementedError

    @abstractmethod
    async def schedule_tournament_subscription_cancellation_at_period_end(self, subscription_id: str) -> dict:
        raise NotImplementedError

    @abstractmethod
    async def create_subscription_session(
            self,
            customer_email: str,
            price_data: dict[str, Any],
            success_url: str,
            uuid: str,
            cancel_url: str,
            metadata: dict) -> stripe.checkout.Session:
        raise NotImplementedError

    @abstractmethod
    async def retrieve_checkout_session(self, session_id: str) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    async def retrieve_subscription(self, subscription_id: str) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def verify_webhook(self, payload: bytes, sig_header: str) -> dict:
        raise NotImplementedError

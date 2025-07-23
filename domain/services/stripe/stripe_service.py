from abc import ABC, abstractmethod

from domain.purchase.model.purchase import Purchase
from domain.tournament_subscription.model.tournament_subscription import TournamentSubscription


class StripeService(ABC):

    @abstractmethod
    async def create_payment_intent(self, purchase: Purchase):
        raise NotImplementedError

    @abstractmethod
    async def cancel_tournament_subscription(self, subscription_id: str) -> dict:
        raise NotImplementedError

    @abstractmethod
    async def create_subscription_session(
            self,
            customer_email: str,
            price_id: str,
            success_url: str,
            uuid: str,
            cancel_url: str,
            metadata: dict) -> str:
        raise NotImplementedError

    @abstractmethod
    def verify_webhook(self, payload: bytes, sig_header: str) -> dict:
        raise NotImplementedError

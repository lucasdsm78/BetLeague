from abc import ABC, abstractmethod
from typing import Dict

from domain.purchase.model.purchase import Purchase


class StripeService(ABC):

    @abstractmethod
    async def create_payment_intent(self, purchase: Purchase):
        raise NotImplementedError

    @abstractmethod
    def verify_webhook(self, payload: bytes, sig_header: str) -> dict:
        raise NotImplementedError

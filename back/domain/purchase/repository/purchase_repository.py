from abc import ABC, abstractmethod
from typing import Optional

from domain.purchase.model.purchase import Purchase


class PurchaseRepository(ABC):

    @abstractmethod
    async def create(self, purchase: Purchase) -> Optional[Purchase]:
        raise NotImplementedError

    @abstractmethod
    async def find_by_id(self, purchase_id: int) -> Optional[Purchase]:
        raise NotImplementedError

    @abstractmethod
    async def find_by_uuid(self, purchase_uuid: str) -> Optional[Purchase]:
        raise NotImplementedError

    @abstractmethod
    async def find_by_intent(self, intent_id: str) -> Optional[Purchase]:
        raise NotImplementedError

    @abstractmethod
    async def find_all_by_user_id(self, user_id: int) -> list[Purchase]:
        raise NotImplementedError

    @abstractmethod
    async def update(self, purchase: Purchase) -> Optional[Purchase]:
        raise NotImplementedError

    @abstractmethod
    async def commit(self):
        raise NotImplementedError

    @abstractmethod
    async def rollback(self):
        raise NotImplementedError

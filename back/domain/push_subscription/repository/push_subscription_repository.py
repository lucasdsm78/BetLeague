from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from domain.push_subscription.model.push_subscription import PushSubscription


class PushSubscriptionRepository(ABC):

    @abstractmethod
    async def create(self, subscription: PushSubscription) -> PushSubscription:
        raise NotImplementedError

    @abstractmethod
    async def find_by_endpoint(self, endpoint: str) -> Optional[PushSubscription]:
        raise NotImplementedError

    @abstractmethod
    async def find_by_user_id(self, user_id: int) -> list[PushSubscription]:
        raise NotImplementedError

    @abstractmethod
    async def delete_by_endpoint(self, endpoint: str) -> None:
        raise NotImplementedError

    @abstractmethod
    async def delete_by_user_id(self, user_id: int) -> int:
        raise NotImplementedError

    @abstractmethod
    async def update_last_used(self, subscription_id: int, last_used_at: int) -> None:
        raise NotImplementedError

    @abstractmethod
    async def delete_by_id(self, subscription_id: int) -> None:
        raise NotImplementedError

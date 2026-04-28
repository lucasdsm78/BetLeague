from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional


class PushSubscriptionUseCase(ABC):

    @abstractmethod
    async def subscribe(
        self,
        *,
        user_id: int,
        endpoint: str,
        p256dh_key: str,
        auth_key: str,
        user_agent: Optional[str] = None,
    ) -> None:
        raise NotImplementedError

    @abstractmethod
    async def unsubscribe(self, *, user_id: int, endpoint: str) -> None:
        raise NotImplementedError

    @abstractmethod
    async def unsubscribe_all(self, *, user_id: int) -> int:
        raise NotImplementedError

    @abstractmethod
    async def get_vapid_public_key(self) -> str:
        raise NotImplementedError

    @abstractmethod
    async def send_to_user(
        self,
        *,
        user_id: int,
        title: str,
        body: str,
        icon: Optional[str] = None,
        badge: Optional[str] = None,
        tag: Optional[str] = None,
        data: Optional[dict] = None,
        url: Optional[str] = None,
    ) -> int:
        raise NotImplementedError

    @abstractmethod
    async def get_status(self, *, user_id: int) -> tuple[bool, int]:
        raise NotImplementedError

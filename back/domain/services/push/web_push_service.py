from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Mapping


class WebPushService(ABC):

    @abstractmethod
    async def send(
        self,
        endpoint: str,
        p256dh_key: str,
        auth_key: str,
        payload: Mapping[str, Any],
    ) -> bool:
        raise NotImplementedError

    @abstractmethod
    def get_vapid_public_key(self) -> str:
        raise NotImplementedError

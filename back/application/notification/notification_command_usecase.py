from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Mapping, Optional

from domain.notification.model.notification import Notification, NotificationType


class NotificationCommandUseCase(ABC):
    @abstractmethod
    async def create(
        self,
        *,
        user_id: int,
        type: NotificationType,
        title: str,
        message: str,
        data: Mapping[str, Any],
        dedupe_key: Optional[str] = None,
    ) -> Notification:
        raise NotImplementedError

    @abstractmethod
    async def mark_read(self, *, user_id: int, notification_id: int) -> None:
        raise NotImplementedError

    @abstractmethod
    async def mark_all_read(self, *, user_id: int) -> int:
        raise NotImplementedError

    @abstractmethod
    async def delete(self, *, user_id: int, notification_id: int) -> None:
        raise NotImplementedError

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from domain.notification.model.notification import Notification


class NotificationRepository(ABC):
    @abstractmethod
    async def create(self, notification: Notification) -> Notification:
        raise NotImplementedError

    @abstractmethod
    async def list_by_user(self, user_id: int, limit: int, cursor: Optional[str]) -> tuple[list[Notification], Optional[str]]:
        raise NotImplementedError

    @abstractmethod
    async def unread_count(self, user_id: int) -> int:
        raise NotImplementedError

    @abstractmethod
    async def mark_read(self, user_id: int, notification_id: int, read_at: int) -> None:
        raise NotImplementedError

    @abstractmethod
    async def mark_all_read(self, user_id: int, read_at: int) -> int:
        raise NotImplementedError

    @abstractmethod
    async def delete(self, user_id: int, notification_id: int) -> None:
        raise NotImplementedError

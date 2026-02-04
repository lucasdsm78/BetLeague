from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from domain.notification.model.notification import Notification


class NotificationQueryUseCase(ABC):
    @abstractmethod
    async def list_for_user(
        self,
        *,
        user_id: int,
        limit: int,
        cursor: Optional[str],
    ) -> tuple[list[Notification], Optional[str]]:
        raise NotImplementedError

    @abstractmethod
    async def unread_count(self, *, user_id: int) -> int:
        raise NotImplementedError


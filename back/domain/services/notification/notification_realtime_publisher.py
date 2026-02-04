from __future__ import annotations

from abc import ABC, abstractmethod

from domain.notification.model.notification import Notification


class NotificationRealtimePublisher(ABC):
    @abstractmethod
    async def publish_to_user(self, user_id: int, notification: Notification) -> None:
        raise NotImplementedError


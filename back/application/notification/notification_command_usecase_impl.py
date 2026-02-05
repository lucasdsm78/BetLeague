from __future__ import annotations

from typing import Any, Callable, Mapping, Optional, TYPE_CHECKING
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from application.notification.notification_command_usecase import NotificationCommandUseCase
from domain.notification.model.notification import Notification, NotificationType
from domain.notification.repository.notification_repository import NotificationRepository
from domain.services.notification.notification_realtime_publisher import NotificationRealtimePublisher

if TYPE_CHECKING:
    from application.push_subscription.push_subscription_usecase import PushSubscriptionUseCase

logger = logging.getLogger(__name__)


def _now_ms() -> int:
    import datetime

    return int(datetime.datetime.utcnow().timestamp() * 1000)


class NotificationCommandUseCaseImpl(NotificationCommandUseCase):
    def __init__(
        self,
        *,
        notification_repository: NotificationRepository,
        realtime_publisher: NotificationRealtimePublisher,
        session_factory: Callable[[], AsyncSession],
        push_subscription_uc: Optional["PushSubscriptionUseCase"] = None,
    ):
        self._notification_repository = notification_repository
        self._realtime_publisher = realtime_publisher
        self._session_factory = session_factory
        self._push_uc = push_subscription_uc

    async def create(
        self,
        *,
        user_id: int,
        type: NotificationType,
        title: str,
        message: str,
        data: Mapping[str, Any],
    ) -> Notification:
        created_at = _now_ms()
        notification = Notification(
            id=None,
            user_id=user_id,
            type=type,
            title=title,
            message=message,
            data=dict(data),
            created_at=created_at,
            read_at=None,
        )

        created = await self._notification_repository.create(notification)

        try:
            await self._realtime_publisher.publish_to_user(user_id, created)
        except Exception:
            pass

        if self._push_uc is not None:
            try:
                await self._push_uc.send_to_user(
                    user_id=user_id,
                    title=title,
                    body=message,
                    icon="/icons/notification-icon.svg",
                    badge="/icons/badge-icon.svg",
                    tag=f"notification-{created.id}",
                    data={
                        "notification_id": created.id,
                        "type": str(type),
                        **dict(data),
                    },
                    url="/notifications",
                )
            except Exception as e:
                logger.warning("Push notification failed", extra={"error": str(e), "user_id": user_id})

        return created

    async def mark_read(self, *, user_id: int, notification_id: int) -> None:
        read_at = _now_ms()
        await self._notification_repository.mark_read(
            user_id=user_id,
            notification_id=notification_id,
            read_at=read_at,
        )

    async def mark_all_read(self, *, user_id: int) -> int:
        read_at = _now_ms()
        updated = await self._notification_repository.mark_all_read(user_id=user_id, read_at=read_at)
        return updated

    async def delete(self, *, user_id: int, notification_id: int) -> None:
        await self._notification_repository.delete(user_id=user_id, notification_id=notification_id)

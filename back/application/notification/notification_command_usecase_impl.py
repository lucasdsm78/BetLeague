from __future__ import annotations

from typing import Any, Callable, Mapping, Optional, TYPE_CHECKING
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from application.notification.notification_command_usecase import NotificationCommandUseCase, NotificationCreateCommand
from domain.notification.model.notification import Notification, NotificationType
from domain.notification.repository.notification_repository import NotificationRepository
from domain.services.notification.notification_realtime_publisher import NotificationRealtimePublisher

if TYPE_CHECKING:
    from application.push_subscription.push_subscription_usecase import PushSubscriptionUseCase

logger = logging.getLogger(__name__)


def _now_ms() -> int:
    import datetime

    return int(datetime.datetime.now(datetime.UTC).timestamp() * 1000)


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
        dedupe_key: Optional[str] = None,
    ) -> Notification:
        payload = dict(data)
        effective_dedupe_key = (dedupe_key or str(payload.get("dedupe_key") or "")).strip()
        if effective_dedupe_key:
            payload.setdefault("dedupe_key", effective_dedupe_key)

        created_at = _now_ms()
        notification = Notification(
            id=None,
            user_id=user_id,
            type=type,
            title=title,
            message=message,
            data=payload,
            created_at=created_at,
            read_at=None,
        )

        created, inserted = await self._notification_repository.create_or_get(notification)
        if not inserted:
            logger.info(
                "notification.deduplicated",
                extra={
                    "notification_id": created.id,
                    "user_id": user_id,
                    "type": str(type),
                    "dedupe_key": effective_dedupe_key,
                },
            )
            return created

        logger.info(
            "notification.created",
            extra={
                "notification_id": created.id,
                "user_id": user_id,
                "type": str(type),
            },
        )

        try:
            await self._realtime_publisher.publish_to_user(user_id, created)
            logger.info("notification.realtime_published", extra={"notification_id": created.id, "user_id": user_id})
        except Exception:
            logger.exception("notification.realtime_publish_failed", extra={"notification_id": created.id, "user_id": user_id})
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
                logger.info("notification.push_dispatched", extra={"notification_id": created.id, "user_id": user_id})
            except Exception as e:
                logger.warning("notification.push_failed", extra={"error": str(e), "user_id": user_id, "notification_id": created.id})

        return created

    async def create_many(
        self,
        *,
        items: list[NotificationCreateCommand],
    ) -> list[Notification]:
        if not items:
            return []

        notifications: list[Notification] = []
        for item in items:
            payload = dict(item.data)
            effective_dedupe_key = (item.dedupe_key or str(payload.get("dedupe_key") or "")).strip()
            if effective_dedupe_key:
                payload.setdefault("dedupe_key", effective_dedupe_key)
            notifications.append(
                Notification(
                    id=None,
                    user_id=item.user_id,
                    type=item.type,
                    title=item.title,
                    message=item.message,
                    data=payload,
                    created_at=_now_ms(),
                    read_at=None,
                )
            )

        persisted = await self._notification_repository.create_many(notifications)
        created_notifications: list[Notification] = []
        for created, inserted in persisted:
            created_notifications.append(created)
            if not inserted:
                logger.info(
                    "notification.deduplicated",
                    extra={
                        "notification_id": created.id,
                        "user_id": created.user_id,
                        "type": str(created.type),
                        "dedupe_key": str(created.data.get("dedupe_key") or ""),
                    },
                )
                continue

            logger.info(
                "notification.created",
                extra={
                    "notification_id": created.id,
                    "user_id": created.user_id,
                    "type": str(created.type),
                },
            )

            try:
                await self._realtime_publisher.publish_to_user(created.user_id, created)
                logger.info("notification.realtime_published", extra={"notification_id": created.id, "user_id": created.user_id})
            except Exception:
                logger.exception("notification.realtime_publish_failed", extra={"notification_id": created.id, "user_id": created.user_id})

            if self._push_uc is not None:
                try:
                    await self._push_uc.send_to_user(
                        user_id=created.user_id,
                        title=created.title,
                        body=created.message,
                        icon="/icons/notification-icon.svg",
                        badge="/icons/badge-icon.svg",
                        tag=f"notification-{created.id}",
                        data={
                            "notification_id": created.id,
                            "type": str(created.type),
                            **dict(created.data),
                        },
                        url="/notifications",
                    )
                    logger.info("notification.push_dispatched", extra={"notification_id": created.id, "user_id": created.user_id})
                except Exception as e:
                    logger.warning("notification.push_failed", extra={"error": str(e), "user_id": created.user_id, "notification_id": created.id})

        return created_notifications

    async def mark_read(self, *, user_id: int, notification_id: int) -> None:
        read_at = _now_ms()
        await self._notification_repository.mark_read(
            user_id=user_id,
            notification_id=notification_id,
            read_at=read_at,
        )
        logger.info("notification.mark_read", extra={"user_id": user_id, "notification_id": notification_id, "read_at": read_at})

    async def mark_all_read(self, *, user_id: int) -> int:
        read_at = _now_ms()
        updated = await self._notification_repository.mark_all_read(user_id=user_id, read_at=read_at)
        logger.info("notification.mark_all_read", extra={"user_id": user_id, "updated_count": updated, "read_at": read_at})
        return updated

    async def delete(self, *, user_id: int, notification_id: int) -> None:
        await self._notification_repository.delete(user_id=user_id, notification_id=notification_id)
        logger.info("notification.deleted", extra={"user_id": user_id, "notification_id": notification_id})

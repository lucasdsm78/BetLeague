from __future__ import annotations

import time
from typing import Any, Callable, Optional
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from domain.push_subscription.model.push_subscription import PushSubscription
from domain.push_subscription.repository.push_subscription_repository import PushSubscriptionRepository
from domain.services.push.web_push_service import WebPushService
from application.push_subscription.push_subscription_usecase import PushSubscriptionUseCase


def _now_ms() -> int:
    return int(time.time() * 1000)


logger = logging.getLogger(__name__)


class PushSubscriptionUseCaseImpl(PushSubscriptionUseCase):

    def __init__(
        self,
        *,
        push_subscription_repository: PushSubscriptionRepository,
        web_push_service: WebPushService,
        session_factory: Callable[[], AsyncSession],
    ):
        self._repo = push_subscription_repository
        self._push_service = web_push_service
        self._session_factory = session_factory

    async def subscribe(
        self,
        *,
        user_id: int,
        endpoint: str,
        p256dh_key: str,
        auth_key: str,
        user_agent: Optional[str] = None,
    ) -> None:
        existing = await self._repo.find_by_endpoint(endpoint)
        if existing is not None:
            if existing.user_id == user_id:
                await self._repo.update_last_used(existing.id, _now_ms())
                logger.info("push.subscription.refreshed", extra={"user_id": user_id, "subscription_id": existing.id})
                return
            await self._repo.delete_by_endpoint(endpoint)
            logger.info("push.subscription.reassigned", extra={"user_id": user_id, "previous_user_id": existing.user_id, "subscription_id": existing.id})

        subscription = PushSubscription(
            id=None,
            user_id=user_id,
            endpoint=endpoint,
            p256dh_key=p256dh_key,
            auth_key=auth_key,
            user_agent=user_agent,
            created_at=_now_ms(),
            last_used_at=None,
        )
        await self._repo.create(subscription)
        logger.info("push.subscription.created", extra={"user_id": user_id, "has_user_agent": bool(user_agent)})

    async def unsubscribe(self, *, user_id: int, endpoint: str) -> None:
        existing = await self._repo.find_by_endpoint(endpoint)
        if existing is not None and existing.user_id == user_id:
            await self._repo.delete_by_endpoint(endpoint)
            logger.info("push.subscription.deleted", extra={"user_id": user_id, "subscription_id": existing.id})

    async def unsubscribe_all(self, *, user_id: int) -> int:
        deleted = await self._repo.delete_by_user_id(user_id)
        logger.info("push.subscription.deleted_all", extra={"user_id": user_id, "deleted_count": deleted})
        return deleted

    async def get_vapid_public_key(self) -> str:
        return self._push_service.get_vapid_public_key()

    async def get_status(self, *, user_id: int) -> tuple[bool, int]:
        subs = await self._repo.find_by_user_id(user_id)
        status = (len(subs) > 0, len(subs))
        logger.info("push.subscription.status_loaded", extra={"user_id": user_id, "has_subscription": status[0], "subscriptions_count": status[1]})
        return status

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
        subscriptions = await self._repo.find_by_user_id(user_id)
        if not subscriptions:
            logger.info("push.send_noop", extra={"user_id": user_id, "reason": "no_subscriptions"})
            return 0

        payload: dict[str, Any] = {
            "title": title,
            "body": body,
        }
        if icon:
            payload["icon"] = icon
        if badge:
            payload["badge"] = badge
        if tag:
            payload["tag"] = tag
        if data:
            payload["data"] = data
        if url:
            payload["url"] = url

        success_count = 0
        expired_sub_ids: list[int] = []

        for sub in subscriptions:
            try:
                ok = await self._push_service.send(
                    endpoint=sub.endpoint,
                    p256dh_key=sub.p256dh_key,
                    auth_key=sub.auth_key,
                    payload=payload,
                )
                if ok:
                    success_count += 1
                    await self._repo.update_last_used(sub.id, _now_ms())
                else:
                    expired_sub_ids.append(sub.id)
            except Exception as e:
                logger.warning(
                    "push.send_failed",
                    extra={"user_id": user_id, "subscription_id": sub.id, "error": str(e)},
                )

        for sub_id in expired_sub_ids:
            try:
                await self._repo.delete_by_id(sub_id)
                logger.info("push.subscription.expired_deleted", extra={"subscription_id": sub_id, "user_id": user_id})
            except Exception:
                logger.warning("push.delete_expired_failed", extra={"subscription_id": sub_id})

        logger.info(
            "push.send_completed",
            extra={
                "user_id": user_id,
                "subscriptions_count": len(subscriptions),
                "success_count": success_count,
                "expired_count": len(expired_sub_ids),
            },
        )
        return success_count

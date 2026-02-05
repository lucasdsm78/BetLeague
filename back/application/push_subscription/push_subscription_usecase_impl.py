from __future__ import annotations

import time
from typing import Any, Callable, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from domain.push_subscription.model.push_subscription import PushSubscription
from domain.push_subscription.repository.push_subscription_repository import PushSubscriptionRepository
from domain.services.push.web_push_service import WebPushService
from application.push_subscription.push_subscription_usecase import PushSubscriptionUseCase


def _now_ms() -> int:
    return int(time.time() * 1000)


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
                return
            await self._repo.delete_by_endpoint(endpoint)

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

    async def unsubscribe(self, *, user_id: int, endpoint: str) -> None:
        existing = await self._repo.find_by_endpoint(endpoint)
        if existing is not None and existing.user_id == user_id:
            await self._repo.delete_by_endpoint(endpoint)

    async def unsubscribe_all(self, *, user_id: int) -> int:
        return await self._repo.delete_by_user_id(user_id)

    async def get_vapid_public_key(self) -> str:
        return self._push_service.get_vapid_public_key()

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
        failed_endpoints: list[int] = []

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
                    failed_endpoints.append(sub.id)
            except Exception:
                pass

        for sub_id in failed_endpoints:
            try:
                await self._repo.delete_by_id(sub_id)
            except Exception:
                pass

        return success_count

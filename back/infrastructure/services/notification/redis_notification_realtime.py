from __future__ import annotations

import json
import asyncio
import logging
from typing import AsyncIterator

from redis.asyncio import Redis

from domain.notification.model.notification import Notification
from domain.services.notification.notification_realtime_publisher import NotificationRealtimePublisher

logger = logging.getLogger(__name__)


def _notification_to_wire(notification: Notification) -> dict:
    return {
        "id": notification.id,
        "user_id": notification.user_id,
        "type": str(notification.type),
        "title": notification.title,
        "message": notification.message,
        "data": dict(notification.data),
        "created_at": notification.created_at,
        "read_at": notification.read_at,
    }


class RedisNotificationRealtimePublisher(NotificationRealtimePublisher):

    def __init__(self, *, redis: Redis, channel_prefix: str):
        self._redis = redis
        self._prefix = channel_prefix

    def _channel(self, user_id: int) -> str:
        return f"{self._prefix}{user_id}"

    async def publish_to_user(self, user_id: int, notification: Notification) -> None:
        payload = {
            "type": "notification.created",
            "notification": _notification_to_wire(notification),
        }
        msg = json.dumps(payload, separators=(",", ":"))
        try:
            await self._redis.publish(self._channel(user_id), msg)
        except Exception:
            # best-effort: ne pas casser la création de notif si redis est down
            logger.exception("redis.publish_failed")


class RedisNotificationSubscriber:
    """Abonnement Redis pour le SSE.

    On utilise un client dédié par subscription pour éviter les interactions pubsub/commandes.
    """

    def __init__(self, *, redis_url: str, channel_prefix: str):
        self._redis_url = redis_url
        self._prefix = channel_prefix

    def _channel(self, user_id: int) -> str:
        return f"{self._prefix}{user_id}"

    async def subscribe(self, *, user_id: int) -> AsyncIterator[str]:
        redis = Redis.from_url(self._redis_url, decode_responses=False)
        pubsub = redis.pubsub()
        channel = self._channel(user_id)
        await pubsub.subscribe(channel)
        try:
            # Attendre l'ACK subscribe
            async for message in pubsub.listen():
                if message and message.get("type") == "subscribe":
                    break

            async for message in pubsub.listen():
                if not message or message.get("type") != "message":
                    continue
                data = message.get("data")
                if isinstance(data, (bytes, bytearray)):
                    yield data.decode("utf-8")
                elif isinstance(data, str):
                    yield data
        finally:
            try:
                await pubsub.unsubscribe(channel)
            except Exception:
                pass
            try:
                await pubsub.close()
            except Exception:
                pass
            try:
                await redis.close()
            except Exception:
                pass

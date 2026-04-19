from __future__ import annotations

import json
import asyncio
import logging
from typing import AsyncIterator

from redis.asyncio import Redis
from redis.exceptions import RedisError

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
            logger.info(
                "redis.notifications.publish_succeeded",
                extra={
                    "user_id": user_id,
                    "notification_id": notification.id,
                    "notification_type": str(notification.type),
                },
            )
        except Exception:
            # best-effort: ne pas casser la création de notif si redis est down
            logger.exception("redis.notifications.publish_failed", extra={"user_id": user_id, "notification_id": notification.id})


class RedisNotificationSubscriber:
    """Abonnement Redis pour le SSE.

    On utilise un client dédié par subscription pour éviter les interactions pubsub/commandes.
    """

    def __init__(self, *, redis_url: str, channel_prefix: str):
        self._redis_url = redis_url
        self._prefix = channel_prefix

    def _channel(self, user_id: int) -> str:
        return f"{self._prefix}{user_id}"

    def _build_client(self) -> Redis:
        return Redis.from_url(
            self._redis_url,
            decode_responses=False,
            socket_connect_timeout=2,
            socket_timeout=None,
            health_check_interval=30,
            retry_on_timeout=False,
            socket_keepalive=True,
        )

    async def subscribe(self, *, user_id: int) -> AsyncIterator[str]:
        channel = self._channel(user_id)
        reconnect_delay_s = 1.0
        logger.info("redis.notifications.subscribe_opened", extra={"user_id": user_id})

        while True:
            redis: Redis | None = None
            pubsub = None
            try:
                redis = self._build_client()
                pubsub = redis.pubsub(ignore_subscribe_messages=False)
                await pubsub.subscribe(channel)

                # Attendre l'ACK subscribe
                async for message in pubsub.listen():
                    if message and message.get("type") == "subscribe":
                        logger.info("redis.notifications.subscribed", extra={"user_id": user_id})
                        break

                pubsub.ignore_subscribe_messages = True

                async for message in pubsub.listen():
                    if not message or message.get("type") != "message":
                        continue
                    data = message.get("data")
                    if isinstance(data, (bytes, bytearray)):
                        yield data.decode("utf-8")
                    elif isinstance(data, str):
                        yield data
                    else:
                        yield str(data)
            except asyncio.CancelledError:
                logger.info("redis.notifications.subscribe_cancelled", extra={"user_id": user_id})
                raise
            except RedisError:
                logger.warning(
                    "redis.notifications.reconnecting",
                    extra={"user_id": user_id, "delay_s": reconnect_delay_s},
                    exc_info=True,
                )
                await asyncio.sleep(reconnect_delay_s)
            finally:
                try:
                    if pubsub is not None:
                        await pubsub.unsubscribe(channel)
                except Exception:
                    pass
                try:
                    if pubsub is not None:
                        await pubsub.close()
                except Exception:
                    pass
                try:
                    if redis is not None:
                        await redis.close()
                except Exception:
                    pass
                logger.info("redis.notifications.subscribe_closed", extra={"user_id": user_id})

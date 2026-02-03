from __future__ import annotations

import asyncio
import json
from dataclasses import asdict
from typing import Any, AsyncIterator, DefaultDict

from collections import defaultdict

from domain.notification.model.notification import Notification
from domain.services.notification.notification_realtime_publisher import NotificationRealtimePublisher


def _notification_to_wire(notification: Notification) -> dict[str, Any]:
    # dataclass -> dict, en convertissant enum en str
    d = asdict(notification)
    d["type"] = str(notification.type)
    return d


class NotificationsHub(NotificationRealtimePublisher):
    """Hub in-memory: 1 queue par user.

    Simple, rapide, et OK tant qu'on a un seul process/instance.
    Pour du scale horizontal: redis pub/sub ou rabbitmq.
    """

    def __init__(self):
        self._queues: DefaultDict[int, "asyncio.Queue[str]"] = defaultdict(asyncio.Queue)
        self._connections: DefaultDict[int, int] = defaultdict(int)

    async def publish_to_user(self, user_id: int, notification: Notification) -> None:
        payload = {
            "type": "notification.created",
            "notification": _notification_to_wire(notification),
        }
        await self._queues[user_id].put(json.dumps(payload))

    async def subscribe(self, user_id: int) -> AsyncIterator[str]:
        queue = self._queues[user_id]
        while True:
            yield await queue.get()

    def connection_count(self, user_id: int) -> int:
        return int(self._connections.get(user_id, 0))

    def register_connection(self, user_id: int) -> None:
        self._connections[user_id] += 1

    def unregister_connection(self, user_id: int) -> None:
        if self._connections.get(user_id, 0) <= 1:
            self._connections.pop(user_id, None)
        else:
            self._connections[user_id] -= 1

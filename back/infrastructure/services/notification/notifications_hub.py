from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import asdict
from typing import Any, AsyncIterator, DefaultDict

from collections import defaultdict

from domain.notification.model.notification import Notification
from domain.services.notification.notification_realtime_publisher import NotificationRealtimePublisher

logger = logging.getLogger(__name__)


def _notification_to_wire(notification: Notification) -> dict[str, Any]:
    # dataclass -> dict, en convertissant enum en str
    d = asdict(notification)
    d["type"] = str(notification.type)
    return d


class NotificationsHub(NotificationRealtimePublisher):
    """Hub in-memory: broadcast multi-connexions.

    1 queue par connexion SSE (donc plusieurs queues par user). publish() broadcast vers toutes.
    """

    def __init__(self):
        self._user_queues: DefaultDict[int, list["asyncio.Queue[str]"]] = defaultdict(list)
        self._connections: DefaultDict[int, int] = defaultdict(int)

    async def publish_to_user(self, user_id: int, notification: Notification) -> None:
        payload = {
            "type": "notification.created",
            "notification": _notification_to_wire(notification),
        }
        msg = json.dumps(payload)
        queues = list(self._user_queues.get(user_id, []))

        if logger.isEnabledFor(logging.DEBUG):
            logger.debug(
                "notifications.publish",
                extra={
                    "user_id": user_id,
                    "notification_id": notification.id,
                    "notification_type": str(notification.type),
                    "queues": len(queues),
                    "connections": self.connection_count(user_id),
                },
            )

        # broadcast best-effort
        for q in queues:
            try:
                q.put_nowait(msg)
            except Exception:
                # ignore if a queue is closed/full
                pass

    def open_queue(self, user_id: int) -> "asyncio.Queue[str]":
        q: asyncio.Queue[str] = asyncio.Queue()
        self._user_queues[user_id].append(q)
        return q

    def close_queue(self, user_id: int, q: "asyncio.Queue[str]") -> None:
        try:
            self._user_queues[user_id].remove(q)
        except ValueError:
            pass
        if not self._user_queues.get(user_id):
            self._user_queues.pop(user_id, None)

    async def subscribe(self, user_id: int) -> AsyncIterator[str]:
        q = self.open_queue(user_id)
        try:
            while True:
                yield await q.get()
        finally:
            self.close_queue(user_id, q)

    def connection_count(self, user_id: int) -> int:
        return int(self._connections.get(user_id, 0))

    def register_connection(self, user_id: int) -> None:
        self._connections[user_id] += 1

    def unregister_connection(self, user_id: int) -> None:
        if self._connections.get(user_id, 0) <= 1:
            self._connections.pop(user_id, None)
        else:
            self._connections[user_id] -= 1

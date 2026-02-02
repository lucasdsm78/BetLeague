from __future__ import annotations

import base64
import json
from typing import Optional

from sqlalchemy import desc, select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from domain.notification.model.notification import Notification
from domain.notification.repository.notification_repository import NotificationRepository
from infrastructure.postgresql.notification.db_notification import DBNotification


def _encode_cursor(created_at: int, notification_id: int) -> str:
    raw = json.dumps({"created_at": created_at, "id": notification_id}).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("utf-8")


def _decode_cursor(cursor: str) -> tuple[int, int]:
    try:
        raw = base64.urlsafe_b64decode(cursor.encode("utf-8"))
        data = json.loads(raw.decode("utf-8"))
        return int(data["created_at"]), int(data["id"])
    except Exception:
        raise ValueError("Cursor invalide")


class NotificationRepositoryImpl(NotificationRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def create(self, notification: Notification) -> Notification:
        db = DBNotification.from_entity(notification)
        self._session.add(db)
        await self._session.flush()
        await self._session.refresh(db)
        return db.to_entity()

    async def list_by_user(
        self, user_id: int, limit: int, cursor: Optional[str]
    ) -> tuple[list[Notification], Optional[str]]:
        stmt = select(DBNotification).where(DBNotification.user_id == user_id)

        if cursor:
            created_at, n_id = _decode_cursor(cursor)
            stmt = stmt.where(
                (DBNotification.created_at < created_at)
                | ((DBNotification.created_at == created_at) & (DBNotification.id < n_id))
            )

        stmt = stmt.order_by(desc(DBNotification.created_at), desc(DBNotification.id)).limit(limit)
        rows = (await self._session.execute(stmt)).scalars().all()
        items = [r.to_entity() for r in rows]

        next_cursor = None
        if len(items) == limit:
            last = rows[-1]
            next_cursor = _encode_cursor(last.created_at, last.id)

        return items, next_cursor

    async def unread_count(self, user_id: int) -> int:
        stmt = select(func.count(DBNotification.id)).where(
            DBNotification.user_id == user_id, DBNotification.read_at.is_(None)
        )
        return int((await self._session.execute(stmt)).scalar_one())

    async def mark_read(self, user_id: int, notification_id: int, read_at: int) -> None:
        stmt = update(DBNotification).where(
            DBNotification.id == notification_id,
            DBNotification.user_id == user_id,
            DBNotification.read_at.is_(None),
        ).values(read_at=read_at)
        res = await self._session.execute(stmt)
        if res.rowcount == 0:
            return

    async def mark_all_read(self, user_id: int, read_at: int) -> int:
        stmt = update(DBNotification).where(
            DBNotification.user_id == user_id,
            DBNotification.read_at.is_(None),
        ).values(read_at=read_at)
        res = await self._session.execute(stmt)
        return int(res.rowcount or 0)


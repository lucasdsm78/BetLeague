from __future__ import annotations

import base64
import json
from typing import Optional

from sqlalchemy import desc, select, func, update, delete, tuple_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from domain.notification.model.notification import Notification, NotificationType
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
        created, _ = await self.create_or_get(notification)
        return created

    async def create_or_get(self, notification: Notification) -> tuple[Notification, bool]:
        return await self._create_or_get(notification, allow_retry=True)

    async def _create_or_get(self, notification: Notification, *, allow_retry: bool) -> tuple[Notification, bool]:
        dedupe_key = str(notification.data.get("dedupe_key") or "").strip()
        if not dedupe_key:
            db = DBNotification.from_entity(notification)
            self._session.add(db)
            await self._session.flush()
            await self._session.refresh(db)
            return db.to_entity(), True

        values = {
            "user_id": notification.user_id,
            "type": str(notification.type),
            "dedupe_key": dedupe_key,
            "title": notification.title,
            "message": notification.message,
            "data": dict(notification.data),
            "created_at": notification.created_at,
            "read_at": notification.read_at,
        }
        inserted_id = (
            await self._session.execute(
                insert(DBNotification)
                .values(**values)
                .on_conflict_do_nothing(
                    index_elements=["user_id", "type", "dedupe_key"],
                    index_where=DBNotification.dedupe_key.is_not(None),
                )
                .returning(DBNotification.id)
            )
        ).scalar_one_or_none()

        if inserted_id is not None:
            row = (
                await self._session.execute(
                    select(DBNotification).where(DBNotification.id == inserted_id)
                )
            ).scalar_one()
            return row.to_entity(), True

        existing = (
            await self._session.execute(
                select(DBNotification)
                .where(
                    DBNotification.user_id == notification.user_id,
                    DBNotification.type == str(notification.type),
                    DBNotification.dedupe_key == dedupe_key,
                )
                .order_by(desc(DBNotification.created_at), desc(DBNotification.id))
                .limit(1)
            )
        ).scalar_one_or_none()
        if existing is None:
            if allow_retry:
                return await self._create_or_get(notification, allow_retry=False)
            raise LookupError(
                "notification row missing after dedupe conflict resolution"
            )
        return existing.to_entity(), False

    async def create_many(self, notifications: list[Notification]) -> list[tuple[Notification, bool]]:
        if not notifications:
            return []

        if any(not str(notification.data.get("dedupe_key") or "").strip() for notification in notifications):
            return [await self.create_or_get(notification) for notification in notifications]

        requested_keys = [
            (notification.user_id, str(notification.type), str(notification.data.get("dedupe_key") or "").strip())
            for notification in notifications
        ]
        seen_keys: set[tuple[int, str, str]] = set()
        deduped_values: list[dict] = []
        for notification, key in zip(notifications, requested_keys, strict=False):
            if key in seen_keys:
                continue
            seen_keys.add(key)
            deduped_values.append(
                {
                    "user_id": notification.user_id,
                    "type": str(notification.type),
                    "dedupe_key": key[2],
                    "title": notification.title,
                    "message": notification.message,
                    "data": dict(notification.data),
                    "created_at": notification.created_at,
                    "read_at": notification.read_at,
                }
            )

        inserted_rows = (
            await self._session.execute(
                insert(DBNotification)
                .values(deduped_values)
                .on_conflict_do_nothing(
                    index_elements=["user_id", "type", "dedupe_key"],
                    index_where=DBNotification.dedupe_key.is_not(None),
                )
                .returning(DBNotification)
            )
        ).scalars().all()

        inserted_by_key = {
            (int(row.user_id), str(row.type), str(row.dedupe_key)): row.to_entity()
            for row in inserted_rows
        }
        unique_keys = list(dict.fromkeys(requested_keys))
        existing_rows = (
            await self._session.execute(
                select(DBNotification).where(
                    tuple_(DBNotification.user_id, DBNotification.type, DBNotification.dedupe_key).in_(unique_keys)
                )
            )
        ).scalars().all()
        existing_by_key = {
            (int(row.user_id), str(row.type), str(row.dedupe_key)): row.to_entity()
            for row in existing_rows
        }

        inserted_consumed: set[tuple[int, str, str]] = set()
        results: list[tuple[Notification, bool]] = []
        for key in requested_keys:
            notification = inserted_by_key.get(key) or existing_by_key[key]
            inserted = key in inserted_by_key and key not in inserted_consumed
            if inserted:
                inserted_consumed.add(key)
            results.append((notification, inserted))
        return results

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

    async def delete(self, user_id: int, notification_id: int) -> None:
        stmt = delete(DBNotification).where(
            DBNotification.id == notification_id,
            DBNotification.user_id == user_id,
        )
        await self._session.execute(stmt)

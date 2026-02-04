from __future__ import annotations

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.postgresql.outbox.db_outbox_message import DBOutboxMessage


class OutboxRepositoryImpl:
    def __init__(self, session: AsyncSession):
        self._session = session
        self.last_released_locks: int = 0

    async def add(
        self,
        *,
        event_name: str,
        aggregate_type: str,
        aggregate_id: int,
        payload: dict,
        created_at: int,
    ) -> int:
        msg = DBOutboxMessage(
            event_name=event_name,
            aggregate_type=aggregate_type,
            aggregate_id=aggregate_id,
            payload=payload,
            created_at=created_at,
            processed_at=None,
        )
        self._session.add(msg)
        await self._session.flush()
        return int(msg.id)

    async def release_stale_locks(self, *, stale_before_ms: int) -> int:
        stmt = (
            update(DBOutboxMessage)
            .where(
                DBOutboxMessage.processed_at.is_(None),
                DBOutboxMessage.locked_at.is_not(None),
                DBOutboxMessage.locked_at < stale_before_ms,
            )
            .values(locked_at=None, locked_by=None)
        )
        res = await self._session.execute(stmt)
        return int(res.rowcount or 0)

    async def fetch_batch_for_processing(
        self,
        *,
        limit: int,
        worker_id: str,
        locked_at: int,
        lock_ttl_ms: int = 120_000,
    ) -> list[DBOutboxMessage]:
        # Libère d'abord les locks orphelins (worker crash)
        if lock_ttl_ms > 0:
            stale_before = locked_at - lock_ttl_ms
            self.last_released_locks = await self.release_stale_locks(stale_before_ms=stale_before)
        else:
            self.last_released_locks = 0

        stmt = (
            select(DBOutboxMessage)
            .where(
                DBOutboxMessage.processed_at.is_(None),
                DBOutboxMessage.locked_at.is_(None),
            )
            .order_by(DBOutboxMessage.id.asc())
            .limit(limit)
            .with_for_update(skip_locked=True)
        )

        rows: list[DBOutboxMessage] = (await self._session.execute(stmt)).scalars().all()
        if not rows:
            return []

        ids = [int(r.id) for r in rows]
        await self._session.execute(
            update(DBOutboxMessage)
            .where(DBOutboxMessage.id.in_(ids))
            .values(locked_at=locked_at, locked_by=worker_id)
        )
        return rows

    async def mark_processed(self, *, message_id: int, processed_at: int) -> None:
        stmt = (
            update(DBOutboxMessage)
            .where(DBOutboxMessage.id == message_id)
            .values(processed_at=processed_at, locked_at=None, locked_by=None)
        )
        await self._session.execute(stmt)

    async def mark_failed(self, *, message_id: int, attempts: int, last_error: str) -> None:
        stmt = (
            update(DBOutboxMessage)
            .where(DBOutboxMessage.id == message_id)
            .values(attempts=attempts, last_error=last_error, locked_at=None, locked_by=None)
        )
        await self._session.execute(stmt)

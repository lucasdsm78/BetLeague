from __future__ import annotations

import logging
import os
import time
from typing import Callable

from sqlalchemy.ext.asyncio import AsyncSession

from application.events.event_bus import InProcessDomainEventBus
from application.events.jetstream_event_decoder import decode_domain_event
from infrastructure.postgresql.outbox.outbox_repository import OutboxRepositoryImpl
from infrastructure.services.nats_json import nats_dumps


logger = logging.getLogger(__name__)


class OutboxProcessor:
    def __init__(
        self,
        *,
        session_factory: Callable[[], AsyncSession],
        handler_bus: InProcessDomainEventBus,
        batch_size: int = 50,
    ):
        self._session_factory = session_factory
        self._handler_bus = handler_bus
        self._batch_size = batch_size

    async def run_once(self) -> int:
        started_ms = int(time.time() * 1000)
        processed = 0
        worker_id = os.getenv("OUTBOX_WORKER_ID", "local")
        lock_ttl_ms = int(os.getenv("OUTBOX_LOCK_TTL_MS", "120000"))
        max_attempts = int(os.getenv("OUTBOX_MAX_ATTEMPTS", "10"))
        now_ms = int(time.time() * 1000)

        # Phase 1: Lock batch (short transaction)
        async with self._session_factory() as session:
            async with session.begin():
                repo = OutboxRepositoryImpl(session)
                batch = await repo.fetch_batch_for_processing(
                    limit=self._batch_size,
                    worker_id=worker_id,
                    locked_at=now_ms,
                    lock_ttl_ms=lock_ttl_ms,
                    max_attempts=max_attempts,
                )
                to_process = [
                    (int(m.id), m.event_name, m.payload, int(m.attempts or 0))
                    for m in batch
                ]

        if not to_process:
            return 0

        ok_ids: list[int] = []
        failed: list[tuple[int, int, str]] = []

        # Phase 2: Process handlers
        for message_id, event_name, payload, attempts in to_process:
            try:
                decoded = decode_domain_event(payload)
                await self._handler_bus.publish(decoded.event)
                ok_ids.append(message_id)
            except Exception as e:
                failed.append((message_id, attempts + 1, str(e)[:2000]))

        # Phase 3: Mark processed
        if ok_ids:
            processed_at = int(time.time() * 1000)
            async with self._session_factory() as session:
                async with session.begin():
                    await OutboxRepositoryImpl(session).mark_processed_batch(
                        message_ids=ok_ids,
                        processed_at=processed_at,
                    )
            processed = len(ok_ids)

        # Phase 4: Mark failed
        if failed:
            failed_ids = [mid for mid, _, _ in failed]
            last_err = failed[-1][2] if failed else "unknown"
            async with self._session_factory() as session:
                async with session.begin():
                    await OutboxRepositoryImpl(session).mark_failed_increment_attempts_batch(
                        message_ids=failed_ids,
                        last_error=last_err,
                    )

        duration_ms = int(time.time() * 1000) - started_ms
        logger.info(
            "outbox.run_once",
            extra={
                "worker_id": worker_id,
                "batch_size": self._batch_size,
                "processed": processed,
                "failed": len(failed),
                "duration_ms": duration_ms,
            },
        )
        return processed

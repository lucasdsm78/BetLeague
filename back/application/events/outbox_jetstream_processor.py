from __future__ import annotations

import asyncio
import os
import time
from dataclasses import dataclass
from typing import Callable

from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.postgresql.outbox.outbox_repository import OutboxRepositoryImpl
from infrastructure.services.nats_jetstream import JetStreamPublisher, load_jetstream_settings
from infrastructure.services.nats_json import nats_dumps


@dataclass(frozen=True, slots=True)
class JetStreamOutboxProcessorConfig:
    batch_size: int = 50


class JetStreamOutboxProcessor:
    """Outbox -> JetStream publisher."""

    def __init__(
        self,
        *,
        session_factory: Callable[[], AsyncSession],
        publisher: JetStreamPublisher,
        batch_size: int = 50,
    ):
        self._session_factory = session_factory
        self._publisher = publisher
        self._batch_size = batch_size
        self._boot_logged = False
        self._stream_ensured = False

    async def close(self) -> None:
        await self._publisher.close()

    async def _ensure_stream_once(self) -> None:
        if self._stream_ensured:
            return
        await self._publisher.ensure_stream()
        self._stream_ensured = True

    async def run_once(self) -> int:
        started_ms = int(time.time() * 1000)
        processed = 0

        worker_id = os.getenv("OUTBOX_WORKER_ID", "local")
        lock_ttl_ms = int(os.getenv("OUTBOX_LOCK_TTL_MS", "120000"))
        now_ms = int(time.time() * 1000)

        if not self._boot_logged:
            print(
                nats_dumps(
                    {
                        "event": "outbox.jetstream.worker.ready",
                        "worker_id": worker_id,
                        "batch_size": self._batch_size,
                        "nats_url": self._publisher.settings.url,
                        "stream": self._publisher.settings.stream,
                        "subject_prefix": self._publisher.settings.subject_prefix,
                    }
                )
            )
            self._boot_logged = True

        await self._ensure_stream_once()

        # 1) Lock batch en DB (transaction courte)
        async with self._session_factory() as session:
            async with session.begin():
                repo = OutboxRepositoryImpl(session)
                max_attempts = int(os.getenv("OUTBOX_MAX_ATTEMPTS", "10"))
                batch = await repo.fetch_batch_for_processing(
                    limit=self._batch_size,
                    worker_id=worker_id,
                    locked_at=now_ms,
                    lock_ttl_ms=lock_ttl_ms,
                    max_attempts=max_attempts,
                )
                to_publish = [(int(m.id), m.event_name, m.payload) for m in batch]

        if not to_publish:
            return 0

        # 2) Publish réseau en parallèle (hors transaction)
        async def _publish_one(mid: int, en: str, pl: dict) -> tuple[int, str | None]:
            try:
                await self._publisher.publish_event(
                    event_name=en, payload=pl, message_id=str(mid),
                )
                return (mid, None)
            except Exception as e:
                return (mid, str(e)[:2000])

        results = await asyncio.gather(
            *[_publish_one(mid, en, pl) for mid, en, pl in to_publish]
        )

        ok_ids = [mid for mid, err in results if err is None]
        failed_ids = [mid for mid, err in results if err is not None]
        last_error = next((err for _, err in results if err is not None), "")

        processed_at = int(time.time() * 1000)

        # 3) Mark processed en batch (1 transaction)
        if ok_ids:
            async with self._session_factory() as session:
                async with session.begin():
                    updated = await OutboxRepositoryImpl(session).mark_processed_batch(
                        message_ids=ok_ids,
                        processed_at=processed_at,
                    )
            processed += updated

        # 4) Mark failed en batch (1 transaction)
        if failed_ids:
            async with self._session_factory() as session:
                async with session.begin():
                    await OutboxRepositoryImpl(session).mark_failed_increment_attempts_batch(
                        message_ids=failed_ids,
                        last_error=last_error or "publish_failed",
                    )

        duration_ms = int(time.time() * 1000) - started_ms
        print(
            nats_dumps(
                {
                    "event": "outbox.jetstream.run_once",
                    "worker_id": worker_id,
                    "batch_size": self._batch_size,
                    "processed": processed,
                    "failed": len(failed_ids),
                    "duration_ms": duration_ms,
                }
            )
        )

        return processed


def build_jetstream_outbox_processor(*, session_factory: Callable[[], AsyncSession]) -> JetStreamOutboxProcessor:
    settings = load_jetstream_settings()
    publisher = JetStreamPublisher(settings)
    return JetStreamOutboxProcessor(
        session_factory=session_factory,
        publisher=publisher,
        batch_size=int(os.getenv("OUTBOX_BATCH_SIZE", "50")),
    )

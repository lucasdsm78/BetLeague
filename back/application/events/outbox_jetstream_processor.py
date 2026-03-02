from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from typing import Callable

from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.postgresql.outbox.outbox_repository import OutboxRepositoryImpl
from infrastructure.services.nats_jetstream import JetStreamPublisher, load_jetstream_settings


def _dumps(obj: dict) -> str:
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False)


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
                _dumps(
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
                batch = await repo.fetch_batch_for_processing(
                    limit=self._batch_size,
                    worker_id=worker_id,
                    locked_at=now_ms,
                    lock_ttl_ms=lock_ttl_ms,
                )
                to_publish = [(int(m.id), m.event_name, m.payload) for m in batch]

        if not to_publish:
            return 0

        ok_ids: list[int] = []
        failed_ids: list[int] = []
        last_error = ""

        # 2) Publish réseau (hors transaction)
        for message_id, event_name, payload in to_publish:
            try:
                await self._publisher.publish_event(
                    event_name=event_name,
                    payload=payload,
                    message_id=str(message_id),
                )
                ok_ids.append(message_id)
            except Exception as e:
                failed_ids.append(message_id)
                last_error = str(e)[:2000]

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
            _dumps(
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

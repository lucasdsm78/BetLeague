from __future__ import annotations

import time
from dataclasses import asdict, is_dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from application.events.event_bus import DomainEventBus
from domain.utils.domain_event import DomainEvent
from infrastructure.postgresql.outbox.outbox_repository import OutboxRepositoryImpl


def _event_to_payload(event: DomainEvent) -> dict:
    if is_dataclass(event):
        return asdict(event)
    return event.__dict__.copy()


class OutboxDomainEventBus(DomainEventBus):

    def __init__(self, session: AsyncSession):
        self._repo = OutboxRepositoryImpl(session)

    async def publish(self, event: DomainEvent) -> None:
        payload = _event_to_payload(event)

        aggregate_type = payload.get("aggregate_type") or "unknown"
        aggregate_id = int(payload.get("aggregate_id") or payload.get("league_id") or payload.get("id") or 0)
        created_at = int(payload.get("created_at") or 0)

        if created_at == 0:
            created_at = int(time.time() * 1000)

        await self._repo.add(
            event_name=getattr(event, "event_name", type(event).__name__),
            aggregate_type=str(aggregate_type),
            aggregate_id=aggregate_id,
            payload=payload,
            created_at=created_at,
        )


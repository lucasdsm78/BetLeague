from __future__ import annotations

import json
import os
import time
from typing import Callable

try:
    import orjson
except Exception:  # pragma: no cover
    orjson = None

from sqlalchemy.ext.asyncio import AsyncSession

from application.events.event_bus import InProcessDomainEventBus
from domain.utils.domain_event import DomainEvent
from domain.league.events.league_invitation_created import LeagueInvitationCreated
from domain.league.events.league_invitation_accepted import LeagueInvitationAccepted
from domain.league.events.league_invitation_refused import LeagueInvitationRefused
from infrastructure.postgresql.outbox.outbox_repository import OutboxRepositoryImpl


def _deserialize(event_name: str, payload: dict) -> DomainEvent:
    if event_name == "league.invitation.created" or payload.get("event_name") == "league.invitation.created":
        return LeagueInvitationCreated(
            league_id=int(payload["league_id"]),
            league_name=str(payload["league_name"]),
            invited_user_id=int(payload["invited_user_id"]),
            sender_user_id=int(payload["sender_user_id"]),
            sender_pseudo=str(payload["sender_pseudo"]),
        )

    if event_name == "league.invitation.accepted" or payload.get("event_name") == "league.invitation.accepted":
        return LeagueInvitationAccepted(
            league_id=int(payload["league_id"]),
            league_name=str(payload["league_name"]),
            invited_user_id=int(payload["invited_user_id"]),
            invited_user_pseudo=str(payload["invited_user_pseudo"]),
            sender_user_id=int(payload["sender_user_id"]),
        )

    if event_name == "league.invitation.refused" or payload.get("event_name") == "league.invitation.refused":
        return LeagueInvitationRefused(
            league_id=int(payload["league_id"]),
            league_name=str(payload["league_name"]),
            invited_user_id=int(payload["invited_user_id"]),
            invited_user_pseudo=str(payload["invited_user_pseudo"]),
            sender_user_id=int(payload["sender_user_id"]),
        )

    raise ValueError(f"Event non supporté: {event_name}")


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
        worker_id = os.getenv('OUTBOX_WORKER_ID', 'local')
        lock_ttl_ms = int(os.getenv('OUTBOX_LOCK_TTL_MS', '120000'))
        now_ms = int(time.time() * 1000)
        async with self._session_factory() as session:
            async with session.begin():
                repo = OutboxRepositoryImpl(session)
                batch = await repo.fetch_batch_for_processing(
                    limit=self._batch_size,
                    worker_id=worker_id,
                    locked_at=now_ms,
                    lock_ttl_ms=lock_ttl_ms,
                )

                for msg in batch:
                    try:
                        event = _deserialize(msg.event_name, msg.payload)
                        await self._handler_bus.publish(event)
                        await repo.mark_processed(message_id=int(msg.id), processed_at=int(time.time() * 1000))
                        processed += 1
                    except Exception as e:
                        attempts = int((msg.attempts or 0) + 1)
                        await repo.mark_failed(message_id=int(msg.id), attempts=attempts, last_error=str(e)[:2000])

        duration_ms = int(time.time() * 1000) - started_ms
        log_obj = {
            "event": "outbox.run_once",
            "worker_id": worker_id,
            "batch_size": self._batch_size,
            "processed": processed,
            "released_stale_locks": int(getattr(repo, 'last_released_locks', 0)),
            "duration_ms": duration_ms,
        }
        try:
            if orjson is not None:
                print(orjson.dumps(log_obj).decode("utf-8"))
            else:
                print(json.dumps(log_obj, separators=(",", ":")))
        except Exception:
            pass
        return processed

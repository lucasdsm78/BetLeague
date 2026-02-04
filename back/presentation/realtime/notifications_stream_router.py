from __future__ import annotations

import time
import asyncio
from typing import AsyncIterator
import logging

from fastapi import APIRouter, Depends, Request, HTTPException, status
from fastapi.responses import StreamingResponse

from dependency_injections import current_user, get_settings, notifications_hub
from infrastructure.services.notification.threaded_redis_pubsub import ThreadedRedisPubSubSubscriber

router = APIRouter(prefix="/api/realtime", tags=["realtime"])


logger = logging.getLogger(__name__)


def _sse(event: str, data: str) -> str:
    return f"event: {event}\ndata: {data}\n\n"


@router.get("/notifications/stream")
async def notifications_stream(
    request: Request,
    user: dict = Depends(current_user),
    settings=Depends(get_settings),
    hub=Depends(notifications_hub),
):
    user_id = int(user["id"])

    client_ip = request.client.host if request.client else "unknown"
    max_conn = int(getattr(settings, "sse_max_connections_per_user", 2))
    # hub peut être un NotificationsHub (in-memory) ou juste pour compter; on garde le même check
    if hasattr(hub, "connection_count") and hub.connection_count(user_id) >= max_conn:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Trop de connexions temps-r9el ouvertes",
        )

    async def event_generator() -> AsyncIterator[bytes]:
        if hasattr(hub, "register_connection"):
            hub.register_connection(user_id)
        started = time.time()

        yield _sse("connected", "{}").encode("utf-8")
        try:
            heartbeat_s = int(getattr(settings, "sse_heartbeat_seconds", 20))
            idle_timeout_s = int(getattr(settings, "sse_idle_timeout_seconds", 900))
            last_emit = time.time()

            if getattr(settings, "notifications_realtime_driver", "memory") == "redis":
                channel_prefix = getattr(settings, "notifications_redis_channel_prefix", "betleague:notifications:user:")
                channel = f"{channel_prefix}{user_id}"
                redis_url = getattr(settings, "redis_url", None)
                if not redis_url:
                    raise HTTPException(status_code=500, detail="Redis non configuré")

                threaded = ThreadedRedisPubSubSubscriber(redis_url=redis_url, channel=channel)
                it = threaded.subscribe()
                while True:
                    if await request.is_disconnected():
                        break
                    now = time.time()
                    if idle_timeout_s > 0 and (now - started) > idle_timeout_s:
                        break
                    try:
                        payload = await asyncio.wait_for(it.__anext__(), timeout=max(1, heartbeat_s))
                        yield _sse("message", payload).encode("utf-8")
                        last_emit = time.time()
                    except StopAsyncIteration:
                        break
                    except asyncio.TimeoutError:
                        if heartbeat_s > 0 and (time.time() - last_emit) >= heartbeat_s:
                            yield b": ping\n\n"
                            last_emit = time.time()

            else:
                # Fallback memory hub
                q = hub.open_queue(user_id)
                try:
                    while True:
                        if await request.is_disconnected():
                            break
                        now = time.time()
                        if idle_timeout_s > 0 and (now - started) > idle_timeout_s:
                            break
                        try:
                            payload = await asyncio.wait_for(q.get(), timeout=max(1, heartbeat_s))
                            yield _sse("message", payload).encode("utf-8")
                            last_emit = time.time()
                        except asyncio.TimeoutError:
                            if heartbeat_s > 0 and (time.time() - last_emit) >= heartbeat_s:
                                yield b": ping\n\n"
                                last_emit = time.time()
                finally:
                    hub.close_queue(user_id, q)
        finally:
            if hasattr(hub, "unregister_connection"):
                hub.unregister_connection(user_id)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

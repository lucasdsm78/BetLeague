from __future__ import annotations

import time
from typing import AsyncIterator

from fastapi import APIRouter, Depends, Request, HTTPException, status
from fastapi.responses import StreamingResponse

from dependency_injections import current_user, notifications_hub, get_settings
from infrastructure.services.notification.notifications_hub import NotificationsHub
from infrastructure.security.sse_rate_limiter import SlidingWindowRateLimiter

router = APIRouter(prefix="/api/realtime", tags=["realtime"])

_rate_limiter = SlidingWindowRateLimiter(limit=30, window_s=60)


def _sse(event: str, data: str) -> str:
    # SSE: event/name optionnel. Ici on fixe event.
    return f"event: {event}\ndata: {data}\n\n"


@router.get("/notifications/stream")
async def notifications_stream(
    request: Request,
    user: dict = Depends(current_user),
    hub: NotificationsHub = Depends(notifications_hub),
    settings=Depends(get_settings),
):
    user_id = int(user["id"])

    client_ip = request.client.host if request.client else "unknown"
    wanted_limit = int(getattr(settings, "sse_rate_limit_per_minute", 30))
    _rate_limiter._limit = max(1, wanted_limit)  # best-effort: pas thread-safe, mais OK ici.
    rl = _rate_limiter.allow(f"{client_ip}:{user_id}")
    if not rl.allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Trop de tentatives de connexion SSE",
            headers={"Retry-After": str(rl.retry_after_s)},
        )

    max_conn = int(getattr(settings, "sse_max_connections_per_user", 2))
    if hub.connection_count(user_id) >= max_conn:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Trop de connexions temps-réel ouvertes",
        )

    async def event_generator() -> AsyncIterator[bytes]:
        hub.register_connection(user_id)
        started = time.time()

        # petit message initial pour que le client sache qu'il est connecté
        yield _sse("connected", "{}").encode("utf-8")
        try:
            heartbeat_s = int(getattr(settings, "sse_heartbeat_seconds", 20))
            idle_timeout_s = int(getattr(settings, "sse_idle_timeout_seconds", 900))

            last_emit = time.time()
            async for payload in hub.subscribe(user_id):
                now = time.time()
                if await request.is_disconnected():
                    break

                if idle_timeout_s > 0 and (now - started) > idle_timeout_s:
                    break

                if heartbeat_s > 0 and (now - last_emit) >= heartbeat_s:
                    yield b": ping\n\n"
                    last_emit = now

                yield _sse("message", payload).encode("utf-8")
                last_emit = now
        finally:
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

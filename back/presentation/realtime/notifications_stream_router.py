from __future__ import annotations

import asyncio
from typing import AsyncIterator

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from dependency_injections import current_user, notifications_hub
from infrastructure.services.notification.notifications_hub import NotificationsHub

router = APIRouter(prefix="/api/realtime", tags=["realtime"])


def _sse(event: str, data: str) -> str:
    # SSE: event/name optionnel. Ici on fixe event.
    return f"event: {event}\ndata: {data}\n\n"


@router.get("/notifications/stream")
async def notifications_stream(
    request: Request,
    user: dict = Depends(current_user),
    hub: NotificationsHub = Depends(notifications_hub),
):
    user_id = int(user["id"])

    async def event_generator() -> AsyncIterator[bytes]:
        # petit message initial pour que le client sache qu'il est connecté
        yield _sse("connected", "{}").encode("utf-8")

        # heartbeat pour éviter timeouts proxy
        heartbeat_task = asyncio.create_task(_heartbeat(request))
        try:
            async for payload in hub.subscribe(user_id):
                if await request.is_disconnected():
                    break
                yield _sse("message", payload).encode("utf-8")
        finally:
            heartbeat_task.cancel()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def _heartbeat(request: Request, interval_s: int = 20) -> None:
    # On ne peut pas écrire directement dans la réponse ici,
    # mais garder la coroutine active aide, et côté client on peut reconnecter.
    while True:
        if await request.is_disconnected():
            return
        await asyncio.sleep(interval_s)


from __future__ import annotations

import asyncio
import os
from typing import Any

from redis.asyncio import Redis
from sqlalchemy import text

from infrastructure.config import Settings
from infrastructure.postgresql.database import engine
from infrastructure.services.nats_jetstream import build_nats_connect_kwargs


async def check_database() -> None:
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))


async def check_redis(settings: Settings) -> None:
    if not getattr(settings, "redis_url", None):
        return

    client = Redis.from_url(
        settings.redis_url,
        decode_responses=False,
        socket_connect_timeout=getattr(settings, "redis_socket_connect_timeout_s", 2),
        socket_timeout=getattr(settings, "redis_socket_timeout_s", 2),
        health_check_interval=getattr(settings, "redis_health_check_interval_s", 30),
        retry_on_timeout=True,
    )
    try:
        pong = await client.ping()
        if not pong:
            raise RuntimeError("Redis ping returned falsy response")
    finally:
        await client.aclose()


async def check_nats() -> None:
    url = (os.getenv("NATS_URL") or "").strip()
    if not url:
        return

    from nats.aio.client import Client as NATS

    nc = NATS()
    kwargs = build_nats_connect_kwargs(connect_timeout=2, max_reconnect_attempts=0, reconnect_time_wait=0.5)
    try:
        await nc.connect(**kwargs)
    finally:
        if nc.is_connected:
            await nc.drain()


async def readiness_report(settings: Settings) -> tuple[bool, dict[str, Any]]:
    checks: dict[str, str] = {}
    errors: dict[str, str] = {}

    async def _run(name: str, coro) -> None:
        try:
            await asyncio.wait_for(coro, timeout=3)
            checks[name] = "ok"
        except Exception as exc:  # pragma: no cover - exercised by targeted tests via monkeypatching
            checks[name] = "error"
            errors[name] = str(exc)

    await _run("database", check_database())
    await _run("redis", check_redis(settings))
    await _run("nats", check_nats())

    ready = not errors
    payload: dict[str, Any] = {
        "status": "ok" if ready else "degraded",
        "checks": checks,
    }
    if errors:
        payload["errors"] = errors
    return ready, payload


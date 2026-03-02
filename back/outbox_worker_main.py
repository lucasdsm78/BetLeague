from __future__ import annotations

import asyncio
import os
import random
import signal
import time
from dataclasses import dataclass

import json

try:
    import orjson
except Exception:  # pragma: no cover
    orjson = None

from infrastructure.logging_config import setup_logging

from dependency_injections import get_session_factory, outbox_handler_bus_dependency
from application.events.outbox_processor import OutboxProcessor
from application.events.outbox_jetstream_processor import build_jetstream_outbox_processor
from nats.aio.client import Client as NATS
from nats.js.errors import NotFoundError


@dataclass(frozen=True, slots=True)
class WorkerConfig:
    batch_size: int
    poll_interval_ms: int
    max_poll_interval_ms: int
    jitter_ms: int


def _get_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return int(raw)


def load_config() -> WorkerConfig:
    return WorkerConfig(
        batch_size=_get_int("OUTBOX_BATCH_SIZE", 50),
        poll_interval_ms=_get_int("OUTBOX_POLL_INTERVAL_MS", 250),
        max_poll_interval_ms=_get_int("OUTBOX_MAX_POLL_INTERVAL_MS", 5000),
        jitter_ms=_get_int("OUTBOX_JITTER_MS", 100),
    )


async def _wait_for_streams() -> None:
    if os.getenv("OUTBOX_DISPATCH_MODE", "local").strip().lower() != "jetstream":
        return

    url = os.getenv("NATS_URL", "nats://nats:4222")
    stream = os.getenv("NATS_STREAM", "BETLEAGUE")
    dlq_stream = os.getenv("NATS_DLQ_STREAM", f"{stream}_DLQ")

    timeout_s = float(os.getenv("NATS_PROVISION_WAIT_TIMEOUT_SECONDS", "20"))
    poll_s = float(os.getenv("NATS_PROVISION_WAIT_POLL_SECONDS", "0.25"))

    started = time.time()
    boot = {
        "event": "outbox.jetstream.wait_for_streams.start",
        "nats_url": url,
        "stream": stream,
        "dlq_stream": dlq_stream,
        "timeout_s": timeout_s,
        "poll_s": poll_s,
    }
    if orjson is not None:
        print(orjson.dumps(boot).decode("utf-8"))
    else:
        print(json.dumps(boot, separators=(",", ":")))

    last_state: str | None = None
    last_error: str | None = None

    nc = NATS()
    try:
        try:
            await nc.connect(servers=[url], connect_timeout=2, max_reconnect_attempts=-1, reconnect_time_wait=0.5)
        except Exception as e:
            last_state = "nats_unreachable"
            last_error = str(e)
            err = {
                "event": "outbox.jetstream.wait_for_streams.connect_error",
                "nats_url": url,
                "error": last_error,
            }
            if orjson is not None:
                print(orjson.dumps(err).decode("utf-8"))
            else:
                print(json.dumps(err, separators=(",", ":")))
            raise

        js = nc.jetstream()

        while True:
            try:
                await js.stream_info(stream)
                # DLQ: on attend aussi si elle est configurée
                if dlq_stream:
                    await js.stream_info(dlq_stream)

                ok = {
                    "event": "outbox.jetstream.wait_for_streams.ready",
                    "stream": stream,
                    "dlq_stream": dlq_stream,
                    "duration_ms": int((time.time() - started) * 1000),
                }
                if orjson is not None:
                    print(orjson.dumps(ok).decode("utf-8"))
                else:
                    print(json.dumps(ok, separators=(",", ":")))
                return

            except NotFoundError as e:
                last_state = "stream_missing"
                last_error = str(e)
                if time.time() - started >= timeout_s:
                    timeout = {
                        "event": "outbox.jetstream.wait_for_streams.timeout",
                        "nats_url": url,
                        "stream": stream,
                        "dlq_stream": dlq_stream,
                        "timeout_s": timeout_s,
                        "last_state": last_state,
                        "last_error": last_error,
                        "duration_ms": int((time.time() - started) * 1000),
                    }
                    if orjson is not None:
                        print(orjson.dumps(timeout).decode("utf-8"))
                    else:
                        print(json.dumps(timeout, separators=(",", ":")))
                    raise TimeoutError(f"JetStream streams not found after {timeout_s}s: {stream} / {dlq_stream}")
                await asyncio.sleep(poll_s)

            except Exception as e:
                last_state = "unknown_error"
                last_error = str(e)
                if time.time() - started >= timeout_s:
                    timeout = {
                        "event": "outbox.jetstream.wait_for_streams.timeout",
                        "nats_url": url,
                        "stream": stream,
                        "dlq_stream": dlq_stream,
                        "timeout_s": timeout_s,
                        "last_state": last_state,
                        "last_error": last_error,
                        "duration_ms": int((time.time() - started) * 1000),
                    }
                    if orjson is not None:
                        print(orjson.dumps(timeout).decode("utf-8"))
                    else:
                        print(json.dumps(timeout, separators=(",", ":")))
                    raise
                await asyncio.sleep(poll_s)

    finally:
        try:
            await nc.drain()
        finally:
            await nc.close()


async def main() -> None:
    setup_logging(environment=os.getenv("ENVIRONMENT", "dev"))
    config = load_config()

    dispatch_mode = os.getenv("OUTBOX_DISPATCH_MODE", "local").strip().lower()
    if dispatch_mode not in {"local", "jetstream"}:
        dispatch_mode = "local"

    # Wait provisioning (jetstream_provision service)
    await _wait_for_streams()

    worker_id = os.getenv("OUTBOX_WORKER_ID", "local")
    lock_ttl_ms = int(os.getenv("OUTBOX_LOCK_TTL_MS", "120000"))

    boot = {
        "event": "outbox.worker.start",
        "worker_id": worker_id,
        "dispatch_mode": dispatch_mode,
        "batch_size": config.batch_size,
        "poll_interval_ms": config.poll_interval_ms,
        "max_poll_interval_ms": config.max_poll_interval_ms,
        "jitter_ms": config.jitter_ms,
        "lock_ttl_ms": lock_ttl_ms,
    }
    if orjson is not None:
        print(orjson.dumps(boot).decode("utf-8"))
    else:
        print(json.dumps(boot, separators=(",", ":")))

    session_factory = get_session_factory()

    if dispatch_mode == "jetstream":
        processor = build_jetstream_outbox_processor(session_factory=session_factory)
    else:
        handler_bus = outbox_handler_bus_dependency()
        processor = OutboxProcessor(
            session_factory=session_factory,
            handler_bus=handler_bus,
            batch_size=config.batch_size,
        )

    stop_event = asyncio.Event()
    stop_task = asyncio.create_task(stop_event.wait())

    def _stop(*_args):
        stop_event.set()

    def _stop_sync(_signum, _frame):
        _stop()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _stop)
        except NotImplementedError:
            signal.signal(sig, _stop_sync)

    sleep_ms = config.poll_interval_ms

    try:
        while not stop_event.is_set():
            try:
                processed = await processor.run_once()
                if processed > 0:
                    sleep_ms = config.poll_interval_ms
                else:
                    sleep_ms = min(int(sleep_ms * 1.5), config.max_poll_interval_ms)

            except Exception:
                sleep_ms = min(int(sleep_ms * 2), config.max_poll_interval_ms)

            jitter = random.randint(0, config.jitter_ms) if config.jitter_ms > 0 else 0
            await asyncio.wait({stop_task}, timeout=(sleep_ms + jitter) / 1000)
    finally:
        # Drain/close si le processor le supporte (JetStream)
        close = getattr(processor, "close", None)
        if callable(close):
            try:
                await close()
            except Exception:
                pass


if __name__ == "__main__":
    asyncio.run(main())

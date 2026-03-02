from __future__ import annotations

import asyncio
import json
import os
from typing import Any

try:
    import orjson  # type: ignore
except Exception:  # pragma: no cover
    orjson = None

from nats.aio.client import Client as NATS
from nats.js.api import StreamConfig
from nats.js.errors import APIError, NotFoundError

from infrastructure.services.nats_subjects import load_nats_subjects


def _dumps(obj: dict[str, Any]) -> str:
    if orjson is not None:
        return orjson.dumps(obj).decode("utf-8")
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False)


async def _wait_for_jetstream(*, js, timeout_s: float = 10.0) -> None:
    deadline = asyncio.get_event_loop().time() + timeout_s
    last_err: str | None = None
    while True:
        try:
            await js.account_info()
            return
        except Exception as e:
            last_err = str(e)
            if asyncio.get_event_loop().time() >= deadline:
                raise RuntimeError(f"JetStream not ready after {timeout_s}s: {last_err}")
            await asyncio.sleep(0.25)


async def _upsert_stream(*, js, name: str, subjects: list[str]) -> str:
    """Create or update a stream idempotently.

    Returns: "created" | "updated" | "noop"
    """
    try:
        info = await js.stream_info(name)
        current = list(getattr(info.config, "subjects", []) or [])
        if sorted(current) == sorted(subjects):
            return "noop"

        cfg = StreamConfig(
            name=name,
            subjects=subjects,
            retention=getattr(info.config, "retention", None),
            storage=getattr(info.config, "storage", None),
            max_msgs=getattr(info.config, "max_msgs", None),
            max_bytes=getattr(info.config, "max_bytes", None),
            max_age=getattr(info.config, "max_age", None),
            discard=getattr(info.config, "discard", None),
            num_replicas=getattr(info.config, "num_replicas", None),
            duplicate_window=getattr(info.config, "duplicate_window", None),
        )
        await js.update_stream(cfg)
        return "updated"
    except NotFoundError:
        await js.add_stream(name=name, subjects=subjects)
        return "created"


async def main() -> None:
    url = os.getenv("NATS_URL", "nats://nats:4222")
    stream = os.getenv("NATS_STREAM", "BETLEAGUE")
    subject_prefix = os.getenv("NATS_SUBJECT_PREFIX", "betleague")

    # DLQ
    dlq_stream = os.getenv("NATS_DLQ_STREAM", f"{stream}_DLQ")
    dlq_subject_prefix = os.getenv("NATS_DLQ_SUBJECT_PREFIX", f"{subject_prefix}.dlq")
    dlq_subjects = [f"{dlq_subject_prefix}.>"]

    # Main subjects (explicit list, no wildcard betleague.>)
    main_subjects = load_nats_subjects(subject_prefix=subject_prefix)

    print(
        _dumps(
            {
                "event": "jetstream.provision.start",
                "nats_url": url,
                "stream": stream,
                "subjects": main_subjects,
                "dlq_stream": dlq_stream,
                "dlq_subjects": dlq_subjects,
                "orjson": bool(orjson is not None),
            }
        )
    )

    nc = NATS()
    try:
        await nc.connect(
            servers=[url],
            connect_timeout=2,
            max_reconnect_attempts=30,
            reconnect_time_wait=0.5,
        )
    except Exception as e:
        print(
            _dumps(
                {
                    "event": "jetstream.provision.connect_error",
                    "nats_url": url,
                    "error": str(e),
                }
            )
        )
        raise

    js = nc.jetstream()

    try:
        await _wait_for_jetstream(js=js, timeout_s=float(os.getenv("NATS_JS_READY_TIMEOUT_SECONDS", "15")))

        op_main = await _upsert_stream(js=js, name=stream, subjects=main_subjects)
        op_dlq = await _upsert_stream(js=js, name=dlq_stream, subjects=dlq_subjects)

        print(
            _dumps(
                {
                    "event": "jetstream.provision.done",
                    "stream": stream,
                    "stream_op": op_main,
                    "dlq_stream": dlq_stream,
                    "dlq_op": op_dlq,
                }
            )
        )

    except (APIError, Exception) as e:
        print(_dumps({"event": "jetstream.provision.error", "error": str(e)}))
        raise

    finally:
        try:
            await nc.drain()
        finally:
            await nc.close()


if __name__ == "__main__":
    asyncio.run(main())


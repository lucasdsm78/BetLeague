from __future__ import annotations

import asyncio
import os
import json

try:
    import orjson  # type: ignore
except Exception:  # pragma: no cover
    orjson = None

from nats.aio.client import Client as NATS
from nats.js.api import ConsumerConfig


def _dumps(obj: dict) -> str:
    if orjson is not None:
        return orjson.dumps(obj).decode("utf-8")
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False)


async def main() -> None:
    url = os.getenv("NATS_URL", "nats://localhost:4222")
    stream = os.getenv("NATS_STREAM", "BETLEAGUE")
    subject_prefix = os.getenv("NATS_SUBJECT_PREFIX", "betleague")
    durable = os.getenv("NATS_DURABLE", "betleague_consumer")

    # Subscribe to all BetLeague events by default
    subject = os.getenv("NATS_SUBJECT", f"{subject_prefix}.>")

    print(_dumps({
        "event": "jetstream.consumer.start",
        "nats_url": url,
        "stream": stream,
        "subject": subject,
        "durable": durable,
        "orjson": bool(orjson is not None),
    }))

    nc = NATS()
    try:
        await nc.connect(servers=[url])
    except Exception as e:
        print(_dumps({
            "event": "jetstream.consumer.connect_error",
            "error": str(e),
            "nats_url": url,
        }))
        raise

    js = nc.jetstream()

    # Ensure stream exists (safe in dev; in prod, provision via IaC)
    try:
        await js.stream_info(stream)
    except Exception:
        try:
            await js.add_stream(name=stream, subjects=[f"{subject_prefix}.>"])
            print(_dumps({
                "event": "jetstream.consumer.stream_created",
                "stream": stream,
                "subjects": [f"{subject_prefix}.>"],
            }))
        except Exception as e:
            print(_dumps({
                "event": "jetstream.consumer.stream_create_error",
                "error": str(e),
                "stream": stream,
            }))
            raise

    async def handler(msg):
        try:
            if orjson is not None:
                payload = orjson.loads(msg.data)
            else:
                payload = json.loads(msg.data.decode("utf-8"))
        except Exception:
            payload = {"raw": msg.data.decode("utf-8", errors="replace")}

        print(_dumps({
            "event": "jetstream.consumer.message",
            "subject": msg.subject,
            "payload": payload,
        }))
        await msg.ack()

    cfg = ConsumerConfig(
        durable_name=durable,
        ack_wait=int(os.getenv("NATS_ACK_WAIT_SECONDS", "30")),
        max_ack_pending=int(os.getenv("NATS_MAX_ACK_PENDING", "1024")),
    )

    try:
        await js.subscribe(
            subject,
            durable=durable,
            manual_ack=True,
            config=cfg,
            cb=handler,
        )
        print(_dumps({
            "event": "jetstream.consumer.subscribed",
            "subject": subject,
            "durable": durable,
        }))
    except Exception as e:
        print(_dumps({
            "event": "jetstream.consumer.subscribe_error",
            "error": str(e),
            "subject": subject,
            "durable": durable,
        }))
        raise

    stop = asyncio.Event()

    def _stop(*_args):
        stop.set()

    loop = asyncio.get_running_loop()
    for sig in ("SIGINT", "SIGTERM"):
        try:
            loop.add_signal_handler(getattr(__import__("signal"), sig), _stop)
        except Exception:
            pass

    await stop.wait()
    await nc.drain()


if __name__ == "__main__":
    asyncio.run(main())

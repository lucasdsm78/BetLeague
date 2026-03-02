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

from application.events.jetstream_event_decoder import decode_domain_event, JetStreamEventDecodeError
from dependency_injections import outbox_handler_bus_dependency


def _dumps(obj: dict) -> str:
    if orjson is not None:
        return orjson.dumps(obj).decode("utf-8")
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False)


def _loads(data: bytes) -> dict:
    if orjson is not None:
        return orjson.loads(data)
    return json.loads(data.decode("utf-8"))


async def main() -> None:
    url = os.getenv("NATS_URL", "nats://localhost:4222")
    stream = os.getenv("NATS_STREAM", "BETLEAGUE")
    subject_prefix = os.getenv("NATS_SUBJECT_PREFIX", "betleague")
    durable = os.getenv("NATS_DURABLE", "betleague_consumer")

    # Subscribe to all BetLeague events by default
    subject = os.getenv("NATS_SUBJECT", f"{subject_prefix}.>")

    # Failure strategy
    max_deliver = int(os.getenv("NATS_MAX_DELIVER", "10"))
    # DLQ is implemented as a subject prefix inside the main stream to avoid subject overlap errors.
    dlq_subject_prefix = os.getenv("NATS_DLQ_SUBJECT_PREFIX", f"{subject_prefix}.dlq")

    print(
        _dumps(
            {
                "event": "jetstream.consumer.start",
                "nats_url": url,
                "stream": stream,
                "subject": subject,
                "durable": durable,
                "orjson": bool(orjson is not None),
                "max_deliver": max_deliver,
                "dlq_subject_prefix": dlq_subject_prefix,
            }
        )
    )

    nc = NATS()
    try:
        await nc.connect(servers=[url])
    except Exception as e:
        print(
            _dumps(
                {
                    "event": "jetstream.consumer.connect_error",
                    "error": str(e),
                    "nats_url": url,
                }
            )
        )
        raise

    js = nc.jetstream()

    # Ensure main stream exists (dev)
    try:
        await js.stream_info(stream)
    except Exception:
        await js.add_stream(name=stream, subjects=[f"{subject_prefix}.>"])

    bus = outbox_handler_bus_dependency()

    async def _publish_to_dlq(*, original_subject: str, payload: dict, error: str, num_delivered: int | None) -> None:
        # Route DLQ by original subject for readability.
        dlq_subject = f"{dlq_subject_prefix}.{original_subject}".replace("*", "STAR").replace(">", "GT")
        envelope = {
            "original_subject": original_subject,
            "num_delivered": num_delivered,
            "error": error,
            "payload": payload,
        }
        data = orjson.dumps(envelope) if orjson is not None else json.dumps(envelope).encode("utf-8")
        await js.publish(dlq_subject, data)

    async def handler(msg):
        num_delivered = None
        try:
            if getattr(msg, "metadata", None) is not None:
                num_delivered = getattr(msg.metadata, "num_delivered", None)
        except Exception:
            num_delivered = None

        try:
            payload = _loads(msg.data)
            decoded = decode_domain_event(payload)

            await bus.publish(decoded.event)

            print(
                _dumps(
                    {
                        "event": "jetstream.consumer.processed",
                        "subject": msg.subject,
                        "event_name": decoded.event_name,
                        "num_delivered": num_delivered,
                    }
                )
            )
            await msg.ack()

        except JetStreamEventDecodeError as e:
            # Permanent failure: send to DLQ and ack
            err = str(e)
            await _publish_to_dlq(
                original_subject=msg.subject,
                payload={"raw": msg.data.decode("utf-8", errors="replace")},
                error=err,
                num_delivered=num_delivered,
            )
            print(
                _dumps(
                    {
                        "event": "jetstream.consumer.dlq.decode_error",
                        "subject": msg.subject,
                        "error": err,
                        "num_delivered": num_delivered,
                    }
                )
            )
            await msg.ack()

        except Exception as e:
            err = str(e)
            # Retry until max_deliver; then DLQ and ack
            if num_delivered is not None and num_delivered >= max_deliver:
                await _publish_to_dlq(
                    original_subject=msg.subject,
                    payload=_loads(msg.data) if msg.data else {},
                    error=err,
                    num_delivered=num_delivered,
                )
                print(
                    _dumps(
                        {
                            "event": "jetstream.consumer.dlq.max_deliver",
                            "subject": msg.subject,
                            "error": err,
                            "num_delivered": num_delivered,
                        }
                    )
                )
                await msg.ack()
            else:
                print(
                    _dumps(
                        {
                            "event": "jetstream.consumer.nak",
                            "subject": msg.subject,
                            "error": err,
                            "num_delivered": num_delivered,
                        }
                    )
                )
                await msg.nak()

    cfg = ConsumerConfig(
        durable_name=durable,
        ack_wait=int(os.getenv("NATS_ACK_WAIT_SECONDS", "30")),
        max_ack_pending=int(os.getenv("NATS_MAX_ACK_PENDING", "1024")),
        max_deliver=max_deliver,
    )

    await js.subscribe(
        subject,
        durable=durable,
        manual_ack=True,
        config=cfg,
        cb=handler,
    )

    print(
        _dumps(
            {
                "event": "jetstream.consumer.subscribed",
                "subject": subject,
                "durable": durable,
            }
        )
    )

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

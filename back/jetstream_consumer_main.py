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
from infrastructure.services.nats_subjects import load_nats_subjects


def _dumps(obj: dict) -> str:
    if orjson is not None:
        return orjson.dumps(obj).decode("utf-8")
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False)


def _loads(data: bytes) -> dict:
    if orjson is not None:
        return orjson.loads(data)
    return json.loads(data.decode("utf-8"))


def _load_consumer_subjects(*, subject_prefix: str, dlq_subject_prefix: str) -> list[str]:
    """Détermine les subjects auxquels le consumer doit s'abonner.

    Priorité:
      1) NATS_CONSUMER_SUBJECTS (CSV) si défini
      2) mêmes subjects que le stream principal (load_nats_subjects)

    Dans tous les cas, on exclut le préfixe DLQ pour éviter que le consumer normal
    consomme les messages parking.
    """
    raw = os.getenv("NATS_CONSUMER_SUBJECTS", "").strip()
    if raw:
        parts = [p.strip() for p in raw.replace(";", ",").split(",")]
        subjects = [p for p in parts if p]
    else:
        subjects = load_nats_subjects(subject_prefix=subject_prefix)

    # Safety: never consume DLQ subjects in the main consumer.
    return [s for s in subjects if not s.startswith(dlq_subject_prefix)]


async def main() -> None:
    url = os.getenv("NATS_URL", "nats://localhost:4222")
    stream = os.getenv("NATS_STREAM", "BETLEAGUE")
    subject_prefix = os.getenv("NATS_SUBJECT_PREFIX", "betleague")
    durable = os.getenv("NATS_DURABLE", "betleague_consumer")

    # Failure strategy
    max_deliver = int(os.getenv("NATS_MAX_DELIVER", "10"))
    dlq_stream = os.getenv("NATS_DLQ_STREAM", f"{stream}_DLQ")
    dlq_subject_prefix = os.getenv("NATS_DLQ_SUBJECT_PREFIX", f"{subject_prefix}.dlq")

    consumer_subjects = _load_consumer_subjects(
        subject_prefix=subject_prefix,
        dlq_subject_prefix=dlq_subject_prefix,
    )

    print(
        _dumps(
            {
                "event": "jetstream.consumer.start",
                "nats_url": url,
                "stream": stream,
                "subjects": consumer_subjects,
                "durable": durable,
                "orjson": bool(orjson is not None),
                "max_deliver": max_deliver,
                "dlq_stream": dlq_stream,
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

    # Streams are provisioned by infra (nats-box / nats config). We only validate presence.
    try:
        await js.stream_info(stream)
    except Exception as e:
        print(
            _dumps(
                {
                    "event": "jetstream.consumer.stream_missing",
                    "stream": stream,
                    "error": str(e),
                    "hint": "Provisionne les streams via nats-box (service nats_provision) ou nats-server.conf (stream_configs).",
                }
            )
        )
        raise

    try:
        await js.stream_info(dlq_stream)
    except Exception as e:
        print(
            _dumps(
                {
                    "event": "jetstream.consumer.dlq_stream_missing",
                    "stream": dlq_stream,
                    "error": str(e),
                    "hint": "Provisionne la DLQ via nats-box (service nats_provision) ou nats-server.conf (stream_configs).",
                }
            )
        )
        raise

    bus = outbox_handler_bus_dependency()

    async def _publish_to_dlq(*, original_subject: str, payload: dict, error: str, num_delivered: int | None) -> None:
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

    # Subscribe to each subject pattern (no wildcard betleague.> to keep DLQ isolated)
    for sub in consumer_subjects:
        await js.subscribe(
            sub,
            durable=f"{durable}__{sub.replace('.', '_').replace('*', 'STAR').replace('>', 'GT')}",
            manual_ack=True,
            config=cfg,
            cb=handler,
        )

    print(
        _dumps(
            {
                "event": "jetstream.consumer.subscribed",
                "subjects": consumer_subjects,
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

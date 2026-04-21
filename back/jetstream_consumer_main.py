from __future__ import annotations

import asyncio
import logging
import os
import time

from nats.aio.client import Client as NATS
from nats.js.api import ConsumerConfig
from nats.js.errors import NotFoundError

from application.events.jetstream_event_decoder import decode_domain_event, JetStreamEventDecodeError
from dependency_injections import outbox_handler_bus_dependency
from infrastructure.logging_config import setup_logging, shutdown_logging
from infrastructure.services.nats_jetstream import build_nats_connect_kwargs
from infrastructure.services.nats_json import nats_loads, nats_encode
from infrastructure.services.nats_subjects import load_nats_subjects

_MAX_INBOUND_BYTES = int(os.getenv("NATS_MAX_INBOUND_PAYLOAD_BYTES", str(2 * 1024 * 1024)))
logger = logging.getLogger(__name__)


def _load_consumer_subjects(*, subject_prefix: str, dlq_subject_prefix: str) -> list[str]:
    """Détermine les subjects auxquels le consumer doit s'abonner.

    Priorité:
      1) NATS_CONSUMER_SUBJECTS (CSV) si défini
      2) mêmes subjects que le stream principal (load_nats_subjects)

    Dans tous les cas, on exclut le préfixe DLQ pour éviter que le consumer normal
    consome les messages parking.
    """
    raw = os.getenv("NATS_CONSUMER_SUBJECTS", "").strip()
    if raw:
        parts = [p.strip() for p in raw.replace(";", ",").split(",")]
        subjects = [p for p in parts if p]
    else:
        subjects = load_nats_subjects(subject_prefix=subject_prefix)

    # Safety: never consume DLQ subjects in the main consumer.
    return [s for s in subjects if not s.startswith(dlq_subject_prefix)]


async def _wait_for_streams(*, js, stream: str, dlq_stream: str) -> None:
    timeout_s = float(os.getenv("NATS_PROVISION_WAIT_TIMEOUT_SECONDS", "20"))
    poll_s = float(os.getenv("NATS_PROVISION_WAIT_POLL_SECONDS", "0.25"))
    started = time.time()

    last_state: str | None = None
    last_error: str | None = None
    attempt = 0

    logger.info(
        "jetstream.consumer.wait_for_streams.start",
        extra={
            "stream": stream,
            "dlq_stream": dlq_stream,
            "timeout_s": timeout_s,
            "poll_s": poll_s,
        },
    )

    while True:
        attempt += 1
        try:
            await js.stream_info(stream)
            await js.stream_info(dlq_stream)
            logger.info(
                "jetstream.consumer.wait_for_streams.ready",
                extra={
                    "stream": stream,
                    "dlq_stream": dlq_stream,
                    "attempt": attempt,
                    "duration_ms": int((time.time() - started) * 1000),
                },
            )
            return

        except NotFoundError as e:
            last_state = "stream_missing"
            last_error = str(e)
            if time.time() - started >= timeout_s:
                logger.warning(
                    "jetstream.consumer.wait_for_streams.timeout",
                    extra={
                        "stream": stream,
                        "dlq_stream": dlq_stream,
                        "timeout_s": timeout_s,
                        "poll_s": poll_s,
                        "attempt": attempt,
                        "last_state": last_state,
                        "last_error": last_error,
                        "duration_ms": int((time.time() - started) * 1000),
                    },
                )
                raise TimeoutError(f"JetStream streams not found after {timeout_s}s: {stream} / {dlq_stream}")
            await asyncio.sleep(poll_s)

        except Exception as e:
            last_state = "unknown_error"
            last_error = str(e)
            if time.time() - started >= timeout_s:
                logger.warning(
                    "jetstream.consumer.wait_for_streams.timeout",
                    extra={
                        "stream": stream,
                        "dlq_stream": dlq_stream,
                        "timeout_s": timeout_s,
                        "poll_s": poll_s,
                        "attempt": attempt,
                        "last_state": last_state,
                        "last_error": last_error,
                        "duration_ms": int((time.time() - started) * 1000),
                    },
                )
                raise
            await asyncio.sleep(poll_s)


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

    logger.info(
        "jetstream.consumer.start",
        extra={
            "nats_url": url,
            "stream": stream,
            "subjects": consumer_subjects,
            "durable": durable,
            "max_deliver": max_deliver,
            "dlq_stream": dlq_stream,
            "dlq_subject_prefix": dlq_subject_prefix,
        },
    )

    connect_kwargs = build_nats_connect_kwargs(url=url)

    nc = NATS()
    try:
        await nc.connect(**connect_kwargs)
    except Exception as e:
        logger.exception(
            "jetstream.consumer.connect_error",
            extra={"nats_url": url},
        )
        raise

    js = nc.jetstream()

    # Wait provisioning (jetstream_provision service)
    await _wait_for_streams(js=js, stream=stream, dlq_stream=dlq_stream)

    bus = outbox_handler_bus_dependency()

    async def _publish_to_dlq(*, original_subject: str, payload: dict, error: str, num_delivered: int | None) -> None:
        dlq_subject = f"{dlq_subject_prefix}.{original_subject}".replace("*", "STAR").replace(">", "GT")
        envelope = {
            "original_subject": original_subject,
            "num_delivered": num_delivered,
            "error": error,
            "payload": payload,
        }
        data = nats_encode(envelope)
        await js.publish(dlq_subject, data)

    async def handler(msg):
        num_delivered = None
        try:
            if getattr(msg, "metadata", None) is not None:
                num_delivered = getattr(msg.metadata, "num_delivered", None)
        except Exception:
            num_delivered = None

        if len(msg.data) > _MAX_INBOUND_BYTES:
            await _publish_to_dlq(
                original_subject=msg.subject,
                payload={"raw_size": len(msg.data)},
                error=f"payload too large: {len(msg.data)} > {_MAX_INBOUND_BYTES}",
                num_delivered=num_delivered,
            )
            logger.warning(
                "jetstream.consumer.dlq.payload_too_large",
                extra={
                    "subject": msg.subject,
                    "size": len(msg.data),
                    "limit": _MAX_INBOUND_BYTES,
                },
            )
            await msg.ack()
            return

        payload: dict | None = None
        try:
            payload = nats_loads(msg.data)
            decoded = decode_domain_event(payload)

            await bus.publish(decoded.event)

            logger.info(
                "jetstream.consumer.processed",
                extra={
                    "subject": msg.subject,
                    "event_name": decoded.event_name,
                    "num_delivered": num_delivered,
                },
            )
            await msg.ack()

        except JetStreamEventDecodeError as e:
            err = str(e)
            await _publish_to_dlq(
                original_subject=msg.subject,
                payload={"raw": msg.data.decode("utf-8", errors="replace")},
                error=err,
                num_delivered=num_delivered,
            )
            logger.warning(
                "jetstream.consumer.dlq.decode_error",
                extra={
                    "subject": msg.subject,
                    "error": err,
                    "num_delivered": num_delivered,
                },
            )
            await msg.ack()

        except Exception as e:
            err = str(e)
            if num_delivered is not None and num_delivered >= max_deliver:
                await _publish_to_dlq(
                    original_subject=msg.subject,
                    payload=payload if payload is not None else {},
                    error=err,
                    num_delivered=num_delivered,
                )
                logger.warning(
                    "jetstream.consumer.dlq.max_deliver",
                    extra={
                        "subject": msg.subject,
                        "error": err,
                        "num_delivered": num_delivered,
                    },
                )
                await msg.ack()
            else:
                logger.warning(
                    "jetstream.consumer.nak",
                    extra={
                        "subject": msg.subject,
                        "error": err,
                        "num_delivered": num_delivered,
                    },
                )
                await msg.nak()

    cfg = ConsumerConfig(
        durable_name=durable,
        ack_wait=int(os.getenv("NATS_ACK_WAIT_SECONDS", "30")),
        max_ack_pending=int(os.getenv("NATS_MAX_ACK_PENDING", "1024")),
        max_deliver=max_deliver,
    )

    for sub in consumer_subjects:
        # "betleague.league.>" -> "league"
        clean = sub.removeprefix(f"{subject_prefix}.").rstrip(".>").replace(".", "_")
        durable_name = f"{durable}_{clean}"

        await js.subscribe(
            sub,
            durable=durable_name,
            manual_ack=True,
            config=cfg,
            cb=handler,
        )

    logger.info(
        "jetstream.consumer.subscribed",
        extra={
            "subjects": consumer_subjects,
            "durable": durable,
        },
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
    setup_logging(
        environment=os.getenv("ENVIRONMENT", "dev"),
        json_logs=None,
        component="jetstream_consumer",
    )
    try:
        asyncio.run(main())
    finally:
        shutdown_logging()

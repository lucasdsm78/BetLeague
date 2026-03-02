from __future__ import annotations

import asyncio
import json
import os
from dataclasses import dataclass

try:
    import orjson  # type: ignore
except Exception:  # pragma: no cover
    orjson = None

from nats.aio.client import Client as NATS

from infrastructure.services.nats_subjects import load_nats_subjects


@dataclass(frozen=True, slots=True)
class JetStreamSettings:
    url: str
    stream: str
    subject_prefix: str


def load_jetstream_settings() -> JetStreamSettings:
    # Local-first: en dev hors Docker on vise localhost; dans Docker compose,
    # NATS_URL est injecté (ex: nats://nats:4222).
    return JetStreamSettings(
        url=os.getenv("NATS_URL", "nats://127.0.0.1:4222"),
        stream=os.getenv("NATS_STREAM", "BETLEAGUE"),
        subject_prefix=os.getenv("NATS_SUBJECT_PREFIX", "betleague"),
    )


def _dumps(obj: dict) -> str:
    if orjson is not None:
        return orjson.dumps(obj).decode("utf-8")
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False)


def _encode(payload: dict) -> bytes:
    if orjson is not None:
        return orjson.dumps(payload)
    return json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def event_name_to_subject(event_name: str, *, subject_prefix: str) -> str:
    # Convention: "ticket.choices.resolved" -> "betleague.ticket.choices.resolved"
    event_name = (event_name or "unknown").strip()
    if not event_name:
        event_name = "unknown"
    return f"{subject_prefix}.{event_name}"


class JetStreamPublisher:
    def __init__(self, settings: JetStreamSettings):
        self._settings = settings
        self._nc = NATS()
        self._js = None
        self._lock = asyncio.Lock()
        self._boot_logged = False
        self._stream_ready = False

    @property
    def settings(self) -> JetStreamSettings:
        return self._settings

    async def connect(self) -> None:
        async with self._lock:
            if not self._boot_logged:
                print(
                    _dumps(
                        {
                            "event": "jetstream.publisher.start",
                            "nats_url": self._settings.url,
                            "stream": self._settings.stream,
                            "subject_prefix": self._settings.subject_prefix,
                            "orjson": bool(orjson is not None),
                        }
                    )
                )
                self._boot_logged = True

            if self._nc.is_connected:
                return

            try:
                await self._nc.connect(
                    servers=[self._settings.url],
                    connect_timeout=2,
                    max_reconnect_attempts=-1,
                    reconnect_time_wait=0.5,
                )
            except Exception as e:
                print(
                    _dumps(
                        {
                            "event": "jetstream.publisher.connect_error",
                            "nats_url": self._settings.url,
                            "error": str(e),
                        }
                    )
                )
                raise

            self._js = self._nc.jetstream()

    async def ensure_stream(self) -> None:
        """Crée le stream si absent (one-shot).

        On le fait au runtime pour simplifier Docker compose/dev. En prod, tu peux le
        provisionner via IaC.
        """
        if self._stream_ready:
            return

        await self.connect()
        if self._js is None:
            raise RuntimeError("JetStream client not initialized")

        subjects = load_nats_subjects(subject_prefix=self._settings.subject_prefix)

        # Double-check under lock to avoid concurrent stream_info/add_stream
        async with self._lock:
            if self._stream_ready:
                return

            try:
                await self._js.stream_info(self._settings.stream)
            except Exception:
                try:
                    await self._js.add_stream(
                        name=self._settings.stream,
                        subjects=subjects,
                        storage=os.getenv("NATS_STORAGE", "file"),
                        retention=os.getenv("NATS_RETENTION", "limits"),
                        max_msgs=int(os.getenv("NATS_MAX_MSGS", "-1")),
                        max_bytes=int(os.getenv("NATS_MAX_BYTES", "-1")),
                        max_age=int(os.getenv("NATS_MAX_AGE_SECONDS", "0")),
                        duplicates=int(os.getenv("NATS_DUPLICATES_WINDOW_SECONDS", "120")),
                    )
                    print(
                        _dumps(
                            {
                                "event": "jetstream.publisher.stream_created",
                                "stream": self._settings.stream,
                                "subjects": subjects,
                            }
                        )
                    )
                except Exception as e:
                    print(
                        _dumps(
                            {
                                "event": "jetstream.publisher.stream_create_error",
                                "stream": self._settings.stream,
                                "error": str(e),
                            }
                        )
                    )
                    raise

            self._stream_ready = True

    async def publish_event(self, *, event_name: str, payload: dict, message_id: str | None = None) -> None:
        # Assume ensure_stream() called once at startup by processor; keep safety here too.
        await self.ensure_stream()
        if self._js is None:
            raise RuntimeError("JetStream client not initialized")

        subject = event_name_to_subject(event_name, subject_prefix=self._settings.subject_prefix)
        data = _encode(payload)

        headers = None
        if message_id:
            headers = {"Nats-Msg-Id": str(message_id)}

        try:
            await self._js.publish(subject, data, headers=headers)
        except Exception as e:
            print(
                _dumps(
                    {
                        "event": "jetstream.publisher.publish_error",
                        "subject": subject,
                        "stream": self._settings.stream,
                        "error": str(e),
                    }
                )
            )
            raise

    async def close(self) -> None:
        if self._nc.is_connected:
            try:
                await self._nc.drain()
            finally:
                await self._nc.close()

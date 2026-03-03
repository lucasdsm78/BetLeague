from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass

from nats.aio.client import Client as NATS

from infrastructure.services.nats_json import nats_dumps, nats_encode
from infrastructure.services.nats_subjects import load_nats_subjects


_MAX_PAYLOAD_BYTES = int(os.getenv("NATS_MAX_PAYLOAD_BYTES", str(1024 * 1024)))


@dataclass(frozen=True, slots=True)
class JetStreamSettings:
    url: str
    stream: str
    subject_prefix: str
    user: str | None = None
    password: str | None = None


def load_jetstream_settings() -> JetStreamSettings:
    return JetStreamSettings(
        url=os.getenv("NATS_URL", "nats://127.0.0.1:4222"),
        stream=os.getenv("NATS_STREAM", "BETLEAGUE"),
        subject_prefix=os.getenv("NATS_SUBJECT_PREFIX", "betleague"),
        user=os.getenv("NATS_USER") or None,
        password=os.getenv("NATS_PASSWORD") or None,
    )


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
                    nats_dumps(
                        {
                            "event": "jetstream.publisher.start",
                            "nats_url": self._settings.url,
                            "stream": self._settings.stream,
                            "subject_prefix": self._settings.subject_prefix,
                        }
                    )
                )
                self._boot_logged = True

            if self._nc.is_connected:
                return

            connect_kwargs: dict = dict(
                servers=[self._settings.url],
                connect_timeout=2,
                max_reconnect_attempts=-1,
                reconnect_time_wait=0.5,
            )
            if self._settings.user:
                connect_kwargs["user"] = self._settings.user
                connect_kwargs["password"] = self._settings.password or ""

            try:
                await self._nc.connect(**connect_kwargs)
            except Exception as e:
                print(
                    nats_dumps(
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
        """S'assure que le stream existe (one-shot).

        Par défaut en dev, on peut auto-créer le stream.
        Si l'infra provisionne déjà (nats-box / nats-server.conf), mets:
          NATS_PROVISIONED_STREAMS=1
        pour ne jamais modifier le broker depuis l'app.
        """
        if self._stream_ready:
            return

        await self.connect()
        if self._js is None:
            raise RuntimeError("JetStream client not initialized")

        provisioned = os.getenv("NATS_PROVISIONED_STREAMS", "0").strip() in {"1", "true", "TRUE", "yes", "YES"}
        subjects = load_nats_subjects(subject_prefix=self._settings.subject_prefix)

        # Double-check under lock to avoid concurrent stream_info/add_stream
        async with self._lock:
            if self._stream_ready:
                return

            try:
                await self._js.stream_info(self._settings.stream)
            except Exception as e:
                if provisioned:
                    print(
                        nats_dumps(
                            {
                                "event": "jetstream.publisher.stream_missing",
                                "stream": self._settings.stream,
                                "error": str(e),
                                "hint": "Le stream doit exister (provision nats-box / nats-server.conf).",
                            }
                        )
                    )
                    raise

                try:
                    await self._js.add_stream(
                        name=self._settings.stream,
                        subjects=subjects,
                        storage=os.getenv("NATS_STORAGE", "file"),
                        retention=os.getenv("NATS_RETENTION", "limits"),
                        max_msgs=int(os.getenv("NATS_MAX_MSGS", "-1")),
                        max_bytes=int(os.getenv("NATS_MAX_BYTES", "-1")),
                        max_age=int(os.getenv("NATS_MAX_AGE_SECONDS", "0")),
                        duplicate_window=int(os.getenv("NATS_DUPLICATES_WINDOW_SECONDS", "120")),
                    )
                    print(
                        nats_dumps(
                            {
                                "event": "jetstream.publisher.stream_created",
                                "stream": self._settings.stream,
                                "subjects": subjects,
                            }
                        )
                    )
                except Exception as e2:
                    print(
                        nats_dumps(
                            {
                                "event": "jetstream.publisher.stream_create_error",
                                "stream": self._settings.stream,
                                "error": str(e2),
                            }
                        )
                    )
                    raise

            self._stream_ready = True

    async def publish_event(self, *, event_name: str, payload: dict, message_id: str | None = None) -> None:
        await self.connect()
        if self._js is None:
            raise RuntimeError("JetStream client not initialized")

        subject = event_name_to_subject(event_name, subject_prefix=self._settings.subject_prefix)
        data = nats_encode(payload)

        if len(data) > _MAX_PAYLOAD_BYTES:
            raise ValueError(
                f"Payload too large: {len(data)} bytes > {_MAX_PAYLOAD_BYTES} for subject={subject}"
            )

        headers = None
        if message_id:
            headers = {"Nats-Msg-Id": str(message_id)}

        try:
            await self._js.publish(subject, data, headers=headers)
        except Exception as e:
            print(
                nats_dumps(
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

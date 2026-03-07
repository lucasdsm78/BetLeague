from __future__ import annotations

import asyncio
import os
import ssl
from dataclasses import dataclass

from nats.aio.client import Client as NATS

from infrastructure.services.nats_json import nats_dumps, nats_encode


_MAX_PAYLOAD_BYTES = int(os.getenv("NATS_MAX_PAYLOAD_BYTES", str(1024 * 1024)))


@dataclass(frozen=True, slots=True)
class JetStreamSettings:
    url: str
    stream: str
    subject_prefix: str
    user: str | None = None
    password: str | None = None
    tls_cert: str | None = None
    tls_key: str | None = None
    tls_ca: str | None = None


def load_jetstream_settings() -> JetStreamSettings:
    return JetStreamSettings(
        url=os.getenv("NATS_URL", "nats://127.0.0.1:4222"),
        stream=os.getenv("NATS_STREAM", "BETLEAGUE"),
        subject_prefix=os.getenv("NATS_SUBJECT_PREFIX", "betleague"),
        user=os.getenv("NATS_USER") or None,
        password=os.getenv("NATS_PASSWORD") or None,
        tls_cert=os.getenv("NATS_TLS_CERT") or None,
        tls_key=os.getenv("NATS_TLS_KEY") or None,
        tls_ca=os.getenv("NATS_TLS_CA") or None,
    )


def _build_tls_context(
    *,
    tls_cert: str | None,
    tls_key: str | None,
    tls_ca: str | None,
) -> ssl.SSLContext | None:
    """Build a TLS context for NATS client connections.

    Returns None if no TLS env vars are set (plain TCP fallback for dev).
    """
    if not tls_ca and not tls_cert:
        return None

    ctx = ssl.create_default_context(purpose=ssl.Purpose.SERVER_AUTH)

    # Enforce TLS 1.2+ (disable older insecure versions)
    ctx.minimum_version = ssl.TLSVersion.TLSv1_2

    if tls_ca:
        ctx.load_verify_locations(tls_ca)

    if tls_cert and tls_key:
        ctx.load_cert_chain(certfile=tls_cert, keyfile=tls_key)

    return ctx


def build_nats_connect_kwargs(
    *,
    url: str | None = None,
    user: str | None = None,
    password: str | None = None,
    tls_cert: str | None = None,
    tls_key: str | None = None,
    tls_ca: str | None = None,
    connect_timeout: int = 2,
    max_reconnect_attempts: int = -1,
    reconnect_time_wait: float = 0.5,
) -> dict:
    """Single source of truth for NATS connect() kwargs (auth + TLS)."""
    if url is None:
        url = os.getenv("NATS_URL", "nats://127.0.0.1:4222")
    if user is None:
        user = os.getenv("NATS_USER") or None
    if password is None:
        password = os.getenv("NATS_PASSWORD") or None
    if tls_cert is None:
        tls_cert = os.getenv("NATS_TLS_CERT") or None
    if tls_key is None:
        tls_key = os.getenv("NATS_TLS_KEY") or None
    if tls_ca is None:
        tls_ca = os.getenv("NATS_TLS_CA") or None

    kwargs: dict = dict(
        servers=[url],
        connect_timeout=connect_timeout,
        max_reconnect_attempts=max_reconnect_attempts,
        reconnect_time_wait=reconnect_time_wait,
    )

    if user:
        kwargs["user"] = user
        kwargs["password"] = password or ""

    tls_ctx = _build_tls_context(tls_cert=tls_cert, tls_key=tls_key, tls_ca=tls_ca)
    if tls_ctx is not None:
        kwargs["tls"] = tls_ctx

    return kwargs


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

            connect_kwargs = build_nats_connect_kwargs(
                url=self._settings.url,
                user=self._settings.user,
                password=self._settings.password,
                tls_cert=self._settings.tls_cert,
                tls_key=self._settings.tls_key,
                tls_ca=self._settings.tls_ca,
                max_reconnect_attempts=-1,
            )

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

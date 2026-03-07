"""Shared TLS context builder for NATS client connections."""

from __future__ import annotations

import os
import ssl


def build_nats_tls_context() -> ssl.SSLContext | None:
    """Build an SSL context for NATS mTLS if cert files are available.

    Env vars:
      NATS_TLS_CA       - path to CA certificate (required to enable TLS)
      NATS_TLS_CERT     - path to client certificate
      NATS_TLS_KEY      - path to client private key
    """
    ca = os.getenv("NATS_TLS_CA", "").strip()
    if not ca:
        return None

    cert = os.getenv("NATS_TLS_CERT", "").strip()
    key = os.getenv("NATS_TLS_KEY", "").strip()

    ctx = ssl.create_default_context(purpose=ssl.Purpose.SERVER_AUTH, cafile=ca)
    ctx.minimum_version = ssl.TLSVersion.TLSv1_2
    if cert and key:
        ctx.load_cert_chain(certfile=cert, keyfile=key)

    return ctx

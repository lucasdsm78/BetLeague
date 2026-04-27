from __future__ import annotations

import ssl
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import certifi
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from infrastructure.config import Settings

_SSL_QUERY_KEYS = {"ssl", "sslmode", "sslcert", "sslkey", "sslrootcert"}


def sanitize_asyncpg_database_url(database_url: str) -> str:
    parts = urlsplit(database_url)
    filtered_query = [
        (key, value)
        for key, value in parse_qsl(parts.query, keep_blank_values=True)
        if key.lower() not in _SSL_QUERY_KEYS
    ]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(filtered_query, doseq=True), parts.fragment))


def build_asyncpg_ssl_context(settings: Settings) -> ssl.SSLContext | None:
    ssl_mode = getattr(settings, "sqlalchemy_ssl_mode_value", "disable")
    if ssl_mode == "disable":
        return None
    if ssl_mode != "verify-full":
        raise ValueError(
            f"Unsupported SQLALCHEMY_SSL_MODE={ssl_mode!r}. Supported values: disable, verify-full."
        )

    cafile = (getattr(settings, "sqlalchemy_ssl_root_cert_path", "") or "").strip() or certifi.where()
    context = ssl.create_default_context(cafile=cafile)
    context.check_hostname = True
    context.verify_mode = ssl.CERT_REQUIRED
    return context


def build_asyncpg_connect_args(settings: Settings, *, application_name: str) -> dict[str, Any]:
    server_settings: dict[str, str] = {
        "application_name": application_name,
    }
    if bool(getattr(settings, "sqlalchemy_disable_jit", True)):
        server_settings["jit"] = "off"

    connect_args: dict[str, Any] = {
        "command_timeout": int(getattr(settings, "sqlalchemy_command_timeout_seconds", 30)),
        "server_settings": server_settings,
    }

    ssl_context = build_asyncpg_ssl_context(settings)
    if ssl_context is not None:
        connect_args["ssl"] = ssl_context

    return connect_args


def create_configured_async_engine(
    database_url: str,
    *,
    settings: Settings | None = None,
    application_name: str | None = None,
    poolclass: Any | None = None,
) -> AsyncEngine:
    effective_settings = settings or Settings()
    engine_kwargs: dict[str, Any] = {
        "echo": bool(getattr(effective_settings, "sqlalchemy_echo", False)),
        "pool_pre_ping": True,
        "connect_args": build_asyncpg_connect_args(
            effective_settings,
            application_name=application_name or getattr(effective_settings, "sqlalchemy_application_name", "betleague-api"),
        ),
    }

    if poolclass is not None:
        engine_kwargs["poolclass"] = poolclass
    else:
        engine_kwargs.update(
            {
                "pool_size": int(getattr(effective_settings, "sqlalchemy_pool_size", 5)),
                "max_overflow": int(getattr(effective_settings, "sqlalchemy_max_overflow", 10)),
                "pool_recycle": int(getattr(effective_settings, "sqlalchemy_pool_recycle_seconds", 300)),
                "pool_timeout": int(getattr(effective_settings, "sqlalchemy_pool_timeout_seconds", 30)),
            }
        )

    return create_async_engine(sanitize_asyncpg_database_url(database_url), **engine_kwargs)


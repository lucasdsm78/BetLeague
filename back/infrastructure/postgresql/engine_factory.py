from __future__ import annotations

import ssl
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import certifi
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from infrastructure.config import DatabaseSettings, Settings

DatabaseSettingsLike = DatabaseSettings | Settings

_ASYNC_ENGINE_STRIPPED_QUERY_KEYS = {
    "application_name",
    "channel_binding",
    "fallback_application_name",
    "gssencmode",
    "krbsrvname",
    "options",
    "ssl",
    "sslcert",
    "sslkey",
    "sslmode",
    "sslrootcert",
}
_ASYNCPG_SCHEMES = {"postgresql+asyncpg", "postgres+asyncpg"}
_SYNC_POSTGRES_SCHEMES = {
    "postgresql",
    "postgres",
    "postgresql+psycopg2",
    "postgres+psycopg2",
    "postgresql+psycopg",
    "postgres+psycopg",
}


def sanitize_asyncpg_database_url(database_url: str) -> str:
    parts = urlsplit(database_url)
    scheme = parts.scheme.lower()

    if scheme in _ASYNCPG_SCHEMES or scheme in _SYNC_POSTGRES_SCHEMES:
        normalized_scheme = "postgresql+asyncpg"
    elif scheme.startswith("postgresql+") or scheme.startswith("postgres+"):
        raise ValueError(
            f"Unsupported PostgreSQL driver in database URL scheme {parts.scheme!r}. "
            "Use postgresql+asyncpg://, postgresql:// or postgresql+psycopg2://."
        )
    else:
        raise ValueError(
            f"Unsupported database URL scheme {parts.scheme!r}. "
            "BetLeague async database connections require a PostgreSQL URL."
        )

    filtered_query = [
        (key, value)
        for key, value in parse_qsl(parts.query, keep_blank_values=True)
        if key.lower() not in _ASYNC_ENGINE_STRIPPED_QUERY_KEYS
    ]
    return urlunsplit((normalized_scheme, parts.netloc, parts.path, urlencode(filtered_query, doseq=True), parts.fragment))


def build_asyncpg_ssl_context(settings: DatabaseSettingsLike) -> ssl.SSLContext | None:
    ssl_mode = getattr(settings, "sqlalchemy_ssl_mode_value", "disable")
    if ssl_mode == "disable":
        return None
    if ssl_mode != "verify-full":
        raise ValueError(
            f"Unsupported SQLALCHEMY_SSL_MODE={ssl_mode!r}. Supported values: disable, verify-full."
        )

    cafile = (getattr(settings, "sqlalchemy_ssl_root_cert_path", "") or "").strip()
    cadata = (getattr(settings, "sqlalchemy_ssl_root_cert", "") or "").strip()

    context = ssl.create_default_context(cafile=certifi.where())
    if cafile:
        context.load_verify_locations(cafile=cafile)
    if cadata:
        context.load_verify_locations(cadata=cadata)
    context.check_hostname = True
    context.verify_mode = ssl.CERT_REQUIRED
    return context


def build_asyncpg_connect_args(settings: DatabaseSettingsLike, *, application_name: str) -> dict[str, Any]:
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
    settings: DatabaseSettingsLike | None = None,
    application_name: str | None = None,
    poolclass: Any | None = None,
) -> AsyncEngine:
    effective_settings = settings or DatabaseSettings()
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


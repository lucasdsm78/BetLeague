import ssl

import certifi

from infrastructure.config import DatabaseSettings
from infrastructure.postgresql import engine_factory
from infrastructure.postgresql.engine_factory import (
    build_asyncpg_ssl_context,
    create_configured_async_engine,
    sanitize_asyncpg_database_url,
)


def test_sanitize_asyncpg_database_url_normalizes_sync_schemes_and_strips_libpq_only_query_args():
    sanitized = sanitize_asyncpg_database_url(
        "postgresql://user:pass@example.test/db"
        "?sslmode=require&channel_binding=require&application_name=from-url&options=-csearch_path%3Dpublic"
    )

    assert sanitized == "postgresql+asyncpg://user:pass@example.test/db"


def test_create_configured_async_engine_uses_asyncpg_driver_for_sync_style_env_urls():
    settings = DatabaseSettings(
        sqlalchemy_database_url='"postgresql+psycopg2://user:pass@example.test/db?channel_binding=require"',
        environment="dev",
    )

    engine = create_configured_async_engine(
        settings.sqlalchemy_database_url,
        settings=settings,
        application_name="betleague-test",
    )
    try:
        assert engine.sync_engine.url.drivername == "postgresql+asyncpg"
        assert engine.sync_engine.url.query == {}
    finally:
        engine.sync_engine.dispose()


def test_sanitize_asyncpg_database_url_rejects_unknown_postgresql_driver():
    try:
        sanitize_asyncpg_database_url("postgresql+pg8000://user:pass@example.test/db")
    except ValueError as exc:
        assert "Unsupported PostgreSQL driver" in str(exc)
    else:
        raise AssertionError("Expected ValueError for unsupported PostgreSQL driver")


def test_database_settings_normalize_inline_sqlalchemy_ssl_root_cert():
    settings = DatabaseSettings(
        sqlalchemy_database_url="postgresql+asyncpg://user:pass@example.test/db",
        sqlalchemy_ssl_root_cert='"-----BEGIN CERTIFICATE-----\\nMIIB\\n-----END CERTIFICATE-----"',
    )

    assert settings.sqlalchemy_ssl_root_cert == "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----"


def test_build_asyncpg_ssl_context_loads_system_and_inline_custom_ca(monkeypatch):
    class DummySSLContext:
        def __init__(self) -> None:
            self.loaded_locations: list[dict[str, str | None]] = []
            self.check_hostname: bool | None = None
            self.verify_mode: ssl.VerifyMode | None = None

        def load_verify_locations(self, *, cafile=None, capath=None, cadata=None):
            self.loaded_locations.append({"cafile": cafile, "cadata": cadata})

    fake_context = DummySSLContext()
    captured: dict[str, str | None] = {}

    def fake_create_default_context(*, cafile=None, capath=None, cadata=None):
        captured["cafile"] = cafile
        captured["cadata"] = cadata
        return fake_context

    monkeypatch.setattr(engine_factory.ssl, "create_default_context", fake_create_default_context)

    settings = DatabaseSettings(
        sqlalchemy_database_url="postgresql+asyncpg://user:pass@example.test/db",
        environment="prod",
        sqlalchemy_ssl_mode="verify-full",
        sqlalchemy_ssl_root_cert_path="/tmp/postgres-ca.pem",
        sqlalchemy_ssl_root_cert="-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----",
    )

    context = build_asyncpg_ssl_context(settings)

    assert context is fake_context
    assert captured == {"cafile": certifi.where(), "cadata": None}
    assert fake_context.loaded_locations == [
        {"cafile": "/tmp/postgres-ca.pem", "cadata": None},
        {"cafile": None, "cadata": "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----"},
    ]
    assert fake_context.check_hostname is True
    assert fake_context.verify_mode == ssl.CERT_REQUIRED



from infrastructure.config import DatabaseSettings
from infrastructure.postgresql.engine_factory import (
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


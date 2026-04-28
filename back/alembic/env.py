from __future__ import annotations

import asyncio
import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

from infrastructure.config import Settings
from infrastructure.postgresql.engine_factory import create_configured_async_engine
from infrastructure.postgresql.database import Base
from infrastructure.postgresql.init_models import init_models

init_models()

target_metadata = Base.metadata


def get_database_url() -> str:
    settings = Settings()
    return settings.alembic_database_url or settings.sqlalchemy_database_url


def run_migrations_offline() -> None:

    url = get_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
        transaction_per_migration=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    settings = Settings()
    connectable = create_configured_async_engine(
        get_database_url(),
        settings=settings,
        application_name="betleague-migrations",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online_sync() -> None:
    asyncio.run(run_migrations_online())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online_sync()

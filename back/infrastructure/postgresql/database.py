from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from infrastructure.config import DatabaseSettings
from infrastructure.postgresql.engine_factory import create_configured_async_engine

settings = DatabaseSettings()

engine = create_configured_async_engine(
    settings.sqlalchemy_database_url,
    settings=settings,
    application_name=getattr(settings, 'sqlalchemy_application_name', 'betleague-api'),
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

Base = declarative_base()

async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

import asyncio
import logging
import os
import sys
from datetime import date, timedelta

# Celery prefork workers may lose /app from sys.path after fork
_app_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _app_root not in sys.path:
    sys.path.insert(0, _app_root)

from infrastructure.celery.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _make_session_factory():
    """Create a fresh engine + session factory for each task invocation.

    This avoids the 'Future attached to a different loop' error
    that occurs when a module-level engine is reused across
    Celery's per-task event loops.
    """
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
    from infrastructure.config import Settings

    settings = Settings()
    engine = create_async_engine(
        settings.sqlalchemy_database_url,
        echo=bool(getattr(settings, "sqlalchemy_echo", False)),
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
    )
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    return engine, factory


@celery_app.task(
    bind=True,
    name="infrastructure.celery.tasks.fetch_daily_matches",
    max_retries=3,
    default_retry_delay=300,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=900,
)
def fetch_daily_matches(self):
    logger.info("[Celery] Starting fetch_daily_matches task")
    _run_async(_fetch_daily_matches_async())


async def _fetch_daily_matches_async():
    import infrastructure.postgresql.models  # noqa: F401 — resolve ORM relationships
    from infrastructure.config import Settings
    from domain.match.model.sport import Sport
    from infrastructure.services.api_sports.base_client import ApiSportsBaseClient
    from infrastructure.services.api_sports.football_fetch_service import ApiSportsFootballFetchService
    from application.match.match_fetch_usecase import MatchFetchUseCaseImpl

    settings = Settings()
    engine, session_factory = _make_session_factory()

    client = ApiSportsBaseClient(
        base_url=settings.api_sports_football_url,
        api_key=settings.api_sports_key,
    )

    league_ids = frozenset(int(x) for x in settings.api_sports_league_ids.split(","))
    fetch_service = ApiSportsFootballFetchService(client=client, league_ids=league_ids)
    usecase = MatchFetchUseCaseImpl(
        match_fetch_api=fetch_service,
        session_factory=session_factory,
    )

    date_from = date.today()
    date_to = date.today() + timedelta(days=7)

    sports_to_fetch = [Sport.FOOTBALL]

    for sport in sports_to_fetch:
        try:
            count = await usecase.fetch_and_store_matches(
                sport=sport,
                date_from=date_from,
                date_to=date_to,
            )
            logger.info(f"[Celery] Fetched {count} {sport.value} matches")
        except Exception as e:
            logger.error(f"[Celery] Error fetching {sport.value} matches: {e}")

    await client.close()
    await engine.dispose()


@celery_app.task(
    bind=True,
    name="infrastructure.celery.tasks.check_match_scores",
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
)
def check_match_scores(self):
    logger.info("[Celery] Starting check_match_scores task")
    _run_async(_check_match_scores_async())


async def _check_match_scores_async():
    import infrastructure.postgresql.models  # noqa: F401 — resolve ORM relationships
    from infrastructure.config import Settings
    from infrastructure.services.api_sports.base_client import ApiSportsBaseClient
    from infrastructure.services.api_sports.score_service import ApiSportsScoreService
    from infrastructure.services.rabbitmq.publisher_score_service import RabbitMQPublisherScoreServiceImpl
    from application.match.match_command_usecase import MatchCommandUseCaseImpl

    settings = Settings()
    engine, session_factory = _make_session_factory()

    client = ApiSportsBaseClient(
        base_url=settings.api_sports_football_url,
        api_key=settings.api_sports_key,
    )

    score_api = ApiSportsScoreService(client=client)
    publisher = RabbitMQPublisherScoreServiceImpl(settings=settings)

    usecase = MatchCommandUseCaseImpl(
        match_repository=None,
        match_score_api=score_api,
        settings=settings,
        session_factory=session_factory,
        publisher=publisher,
    )

    try:
        result = await usecase.check_scores_v2()
        logger.info(f"[Celery] Score check result: {result}")
    except Exception as e:
        logger.error(f"[Celery] Error checking scores: {e}")
    finally:
        await client.close()
        await engine.dispose()

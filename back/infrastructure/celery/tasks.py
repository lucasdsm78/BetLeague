import asyncio
import logging
from datetime import date, timedelta

from infrastructure.celery.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


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
    from infrastructure.config import Settings
    from infrastructure.postgresql.database import AsyncSessionLocal
    from domain.match.model.sport import Sport
    from infrastructure.services.api_sports.base_client import ApiSportsBaseClient
    from infrastructure.services.api_sports.football_fetch_service import ApiSportsFootballFetchService
    from application.match.match_fetch_usecase import MatchFetchUseCaseImpl

    settings = Settings()

    client = ApiSportsBaseClient(
        base_url=settings.api_sports_football_url,
        api_key=settings.api_sports_key,
    )

    fetch_service = ApiSportsFootballFetchService(client=client)
    usecase = MatchFetchUseCaseImpl(
        match_fetch_api=fetch_service,
        session_factory=AsyncSessionLocal,
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
    from infrastructure.config import Settings
    from infrastructure.postgresql.database import AsyncSessionLocal
    from infrastructure.services.api_sports.base_client import ApiSportsBaseClient
    from infrastructure.services.api_sports.score_service import ApiSportsScoreService
    from infrastructure.services.rabbitmq.publisher_score_service import RabbitMQPublisherScoreServiceImpl
    from application.match.match_command_usecase import MatchCommandUseCaseImpl

    settings = Settings()

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
        session_factory=AsyncSessionLocal,
        publisher=publisher,
    )

    try:
        result = await usecase.check_scores_v2()
        logger.info(f"[Celery] Score check result: {result}")
    except Exception as e:
        logger.error(f"[Celery] Error checking scores: {e}")
    finally:
        await client.close()

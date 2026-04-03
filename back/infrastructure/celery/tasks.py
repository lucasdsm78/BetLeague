import asyncio
import logging
import os
import sys
import time
from datetime import date, timedelta, datetime

# Celery prefork workers may lose /app from sys.path after fork
_app_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _app_root not in sys.path:
    sys.path.insert(0, _app_root)

from infrastructure.celery.celery_app import celery_app

logger = logging.getLogger(__name__)

# Redis client lazy (process-level) for state updates
_redis_state_client_singleton = None


def _redis_state_url() -> str:
    # Dedicated state url (future-proof), fallback to broker.
    return os.getenv("CELERY_STATE_REDIS_URL") or os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/1")


def _redis_state() -> "Redis":
    global _redis_state_client_singleton
    if _redis_state_client_singleton is None:
        from redis import Redis

        _redis_state_client_singleton = Redis.from_url(
            _redis_state_url(),
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
    return _redis_state_client_singleton


def _state_prefix_and_ttl() -> tuple[str, int]:
    base = os.getenv("CELERY_SCORE_CHECK_STATE_PREFIX", "betleague:celery:score_check")
    ttl = int(os.getenv("CELERY_SCORE_CHECK_STATE_TTL_SECONDS", str(7 * 24 * 3600)))
    return base, ttl


def _safe_set(key: str, value: str, *, ex: int) -> None:
    try:
        _redis_state().set(key, value, ex=ex)
    except Exception as e:
        logger.warning(f"[Celery] Unable to persist {key}: {e}")


def _touch_score_check_started(*, now_epoch: int) -> None:
    base, ttl = _state_prefix_and_ttl()
    _safe_set(f"{base}:last_started_at", str(now_epoch), ex=ttl)


def _touch_score_check_finished(*, now_epoch: int) -> None:
    base, ttl = _state_prefix_and_ttl()
    _safe_set(f"{base}:last_finished_at", str(now_epoch), ex=ttl)


def _touch_score_check_failed(*, now_epoch: int, error: str) -> None:
    base, ttl = _state_prefix_and_ttl()
    try:
        pipe = _redis_state().pipeline()
        pipe.set(f"{base}:last_failed_at", str(now_epoch), ex=ttl)
        pipe.set(f"{base}:last_error", (error or "")[:500], ex=ttl)
        pipe.execute()
    except Exception as e:
        logger.warning(f"[Celery] Unable to persist score_check last_failed_at/last_error: {e}")


def _run_async(coro):
    """Run an async coroutine in a dedicated event loop (Celery task context)."""
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
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
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

    started = int(time.time())
    _touch_score_check_started(now_epoch=started)

    try:
        _run_async(_check_match_scores_async())
    except Exception as e:
        _touch_score_check_failed(now_epoch=int(time.time()), error=str(e))
        raise
    finally:
        _touch_score_check_finished(now_epoch=int(time.time()))


@celery_app.task(
    bind=True,
    name="infrastructure.celery.tasks.process_weekly_league_payouts",
    max_retries=3,
    default_retry_delay=300,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=900,
)
def process_weekly_league_payouts(self):
    logger.info(
        "league_payout.task_started",
        extra={
            "event": "league_payout.task_started",
            "task_name": self.name,
            "task_id": getattr(getattr(self, "request", None), "id", None),
        },
    )
    _run_async(_process_weekly_league_payouts_async())


async def _check_match_scores_async():
    import infrastructure.postgresql.models  # noqa: F401 — resolve ORM relationships
    from infrastructure.config import Settings
    from infrastructure.services.api_sports.base_client import ApiSportsBaseClient
    from infrastructure.services.api_sports.score_service import ApiSportsScoreService
    from infrastructure.postgresql.match.match_score_unit_of_work import MatchScoreUnitOfWorkImpl
    from application.match.match_command_usecase import MatchCommandUseCaseImpl

    settings = Settings()
    engine, session_factory = _make_session_factory()

    client = ApiSportsBaseClient(
        base_url=settings.api_sports_football_url,
        api_key=settings.api_sports_key,
    )

    score_api = ApiSportsScoreService(client=client)

    usecase = MatchCommandUseCaseImpl(
        match_score_api=score_api,
        uow_factory=lambda: MatchScoreUnitOfWorkImpl(session_factory=session_factory),
    )

    try:
        result = await usecase.check_scores_v2()
        logger.info(f"[Celery] Score check result: {result}")
    except Exception as e:
        logger.error(f"[Celery] Error checking scores: {e}")
        raise
    finally:
        await client.close()
        await engine.dispose()


async def _process_weekly_league_payouts_async():
    import infrastructure.postgresql.models  # noqa: F401 — resolve ORM relationships
    from infrastructure.scheduler.league_payout_scheduler import LeaguePayoutSchedulerImpl

    engine, session_factory = _make_session_factory()
    scheduler = LeaguePayoutSchedulerImpl(session_factory=session_factory)
    run_at = datetime.utcnow()

    try:
        logger.info(
            "league_payout.task_dispatching",
            extra={
                "event": "league_payout.task_dispatching",
                "as_of": run_at.isoformat(),
            },
        )
        await scheduler.process_due_payouts(as_of=run_at)
        logger.info(
            "league_payout.task_finished",
            extra={
                "event": "league_payout.task_finished",
                "as_of": run_at.isoformat(),
            },
        )
    except Exception:
        logger.exception(
            "league_payout.task_failed",
            extra={
                "event": "league_payout.task_failed",
                "as_of": run_at.isoformat(),
            },
        )
        raise
    finally:
        await engine.dispose()



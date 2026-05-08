import asyncio
import logging
import os
import sys
import time
from datetime import UTC, date, timedelta, datetime
from urllib.parse import urlsplit

from redis import Redis

# Celery prefork workers may lose /app from sys.path after fork
_app_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _app_root not in sys.path:
    sys.path.insert(0, _app_root)

from infrastructure.celery.celery_app import celery_app

logger = logging.getLogger(__name__)

_MAX_FETCH_ODDS_DAYS_AHEAD = 7
_MAX_FETCH_ODDS_FIXTURES_PER_RUN = 30

# Redis client lazy (process-level) for state updates
_redis_state_client_singleton = None


def _task_extra(task=None, **extra):
    payload = {key: value for key, value in extra.items() if value is not None}
    if task is not None:
        payload.setdefault("task_name", getattr(task, "name", None))
        payload.setdefault("task_id", getattr(getattr(task, "request", None), "id", None))
    return payload


def _redis_state_url() -> str:
    # Dedicated state url (future-proof), fallback to broker.
    return os.getenv("CELERY_STATE_REDIS_URL") or os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/1")


def _redis_state() -> "Redis":
    global _redis_state_client_singleton
    if _redis_state_client_singleton is None:
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
    except Exception:
        logger.exception("celery.task.state_persist_failed", extra={"state_key": key, "ttl_s": ex})


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


def _fetch_state_prefix_and_ttl() -> tuple[str, int]:
    base = os.getenv("CELERY_FETCH_MATCHES_STATE_PREFIX", "betleague:celery:fetch_matches")
    ttl = int(os.getenv("CELERY_FETCH_MATCHES_STATE_TTL_SECONDS", str(7 * 24 * 3600)))
    return base, ttl


def _touch_fetch_matches_started(*, now_epoch: int) -> None:
    base, ttl = _fetch_state_prefix_and_ttl()
    _safe_set(f"{base}:last_started_at", str(now_epoch), ex=ttl)


def _touch_fetch_matches_finished(*, now_epoch: int) -> None:
    base, ttl = _fetch_state_prefix_and_ttl()
    _safe_set(f"{base}:last_finished_at", str(now_epoch), ex=ttl)


def _touch_fetch_matches_failed(*, now_epoch: int, error: str) -> None:
    base, ttl = _fetch_state_prefix_and_ttl()
    try:
        pipe = _redis_state().pipeline()
        pipe.set(f"{base}:last_failed_at", str(now_epoch), ex=ttl)
        pipe.set(f"{base}:last_error", (error or "")[:500], ex=ttl)
        pipe.execute()
    except Exception as e:
        logger.warning(f"[Celery] Unable to persist fetch_matches last_failed_at/last_error: {e}")


def _run_async(coro):
    """Run an async coroutine in a dedicated event loop (Celery task context)."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _bounded_non_negative_int(value, *, default: int = 0, hard_cap: int | None = None) -> int:
    try:
        normalized = int(value)
    except (TypeError, ValueError):
        normalized = default
    normalized = max(0, normalized)
    if hard_cap is not None:
        normalized = min(normalized, hard_cap)
    return normalized


def _utc_today() -> date:
    return datetime.now(UTC).date()


def _utc_now_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _make_session_factory():
    """Create a fresh engine + session factory for each task invocation.

    This avoids the 'Future attached to a different loop' error
    that occurs when a module-level engine is reused across
    Celery's per-task event loops.
    """
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
    from infrastructure.config import Settings
    from infrastructure.postgresql.engine_factory import create_configured_async_engine

    settings = Settings()
    engine = create_configured_async_engine(
        settings.sqlalchemy_database_url,
        settings=settings,
        application_name="betleague-celery",
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
    logger.info("celery.task.fetch_daily_matches.started", extra=_task_extra(self))
    started = time.time()
    _touch_fetch_matches_started(now_epoch=int(started))

    try:
        _run_async(_fetch_daily_matches_async(task=self))
    except Exception as e:
        _touch_fetch_matches_failed(now_epoch=int(time.time()), error=str(e))
        logger.exception("celery.task.fetch_daily_matches.failed", extra=_task_extra(self))
        raise
    else:
        _touch_fetch_matches_finished(now_epoch=int(time.time()))
    finally:
        logger.info("celery.task.fetch_daily_matches.finished", extra=_task_extra(self, duration_ms=round((time.time() - started) * 1000, 2)))


async def _fetch_daily_matches_async(*, task=None):
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

    try:
        league_ids = settings.api_sports_league_ids_set
        logger.info(
            "celery.task.fetch_daily_matches.api_client_config",
            extra=_task_extra(
                task,
                api_base_url=settings.api_sports_football_url,
                api_host=urlsplit(settings.api_sports_football_url).hostname,
                api_key_configured=bool((settings.api_sports_key or "").strip()),
                league_ids_count=len(league_ids),
            ),
        )
        odds_days_ahead = _bounded_non_negative_int(
            getattr(settings, "api_sports_fetch_odds_days_ahead", 1),
            default=1,
            hard_cap=_MAX_FETCH_ODDS_DAYS_AHEAD,
        )
        max_odds_fixtures = _bounded_non_negative_int(
            getattr(settings, "api_sports_fetch_odds_max_fixtures_per_run", 0),
            default=0,
            hard_cap=_MAX_FETCH_ODDS_FIXTURES_PER_RUN,
        )
        today = _utc_today()
        odds_date_to = today + timedelta(days=odds_days_ahead)
        fetch_service = ApiSportsFootballFetchService(
            client=client,
            league_ids=league_ids,
            fetch_odds_until=odds_date_to,
            max_odds_fixtures=max_odds_fixtures,
        )
        usecase = MatchFetchUseCaseImpl(
            match_fetch_api=fetch_service,
            session_factory=session_factory,
        )

        date_from = today
        date_to = today + timedelta(days=7)

        sports_to_fetch = [Sport.FOOTBALL]
        total_fetched = 0
        failed_sports: list[str] = []
        first_failure: Exception | None = None

        for sport in sports_to_fetch:
            try:
                count = await usecase.fetch_and_store_matches(
                    sport=sport,
                    date_from=date_from,
                    date_to=date_to,
                )
                total_fetched += int(count)
                logger.info(
                    "celery.task.fetch_daily_matches.sport_finished",
                    extra=_task_extra(task, sport=sport.value, fetched_count=int(count)),
                )
            except Exception as exc:
                logger.exception(
                    "celery.task.fetch_daily_matches.sport_failed",
                    extra=_task_extra(
                        task,
                        sport=sport.value,
                        error_type=type(exc).__name__,
                        error=str(exc),
                    ),
                )
                if first_failure is None:
                    first_failure = exc
                failed_sports.append(sport.value)

        if failed_sports:
            raise RuntimeError(
                f"fetch_daily_matches failed for sports: {', '.join(failed_sports)}"
            ) from first_failure

        logger.info(
            "celery.task.fetch_daily_matches.completed",
            extra=_task_extra(task, sports_count=len(sports_to_fetch), total_fetched_count=total_fetched),
        )
    finally:
        try:
            await client.close()
        except Exception:
            logger.warning("celery.task.fetch_daily_matches.client_close_failed", exc_info=True)
        try:
            await engine.dispose()
        except Exception:
            logger.warning("celery.task.fetch_daily_matches.engine_dispose_failed", exc_info=True)


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
    logger.info("celery.task.check_match_scores.started", extra=_task_extra(self))

    started = int(time.time())
    _touch_score_check_started(now_epoch=started)

    try:
        _run_async(_check_match_scores_async(task=self))
    except Exception as e:
        _touch_score_check_failed(now_epoch=int(time.time()), error=str(e))
        logger.exception("celery.task.check_match_scores.failed", extra=_task_extra(self))
        raise
    else:
        _touch_score_check_finished(now_epoch=int(time.time()))
    finally:
        logger.info("celery.task.check_match_scores.finished", extra=_task_extra(self, duration_ms=round((time.time() - started) * 1000, 2)))


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
        extra=_task_extra(self),
    )
    started = time.time()
    _run_async(_process_weekly_league_payouts_async(task=self))
    logger.info("league_payout.task_finished", extra=_task_extra(self, duration_ms=round((time.time() - started) * 1000, 2)))


@celery_app.task(
    bind=True,
    name="infrastructure.celery.tasks.process_tournaments_scheduler",
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
)
def process_tournaments_scheduler(self):
    logger.info(
        "tournament_scheduler.task_started",
        extra=_task_extra(self),
    )
    started = time.time()
    _run_async(_process_tournaments_scheduler_async(task=self))
    logger.info("tournament_scheduler.task_finished", extra=_task_extra(self, duration_ms=round((time.time() - started) * 1000, 2)))


async def _check_match_scores_async(*, task=None):
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

    score_api = ApiSportsScoreService(
        client=client,
        fallback_enabled=settings.api_sports_score_by_id_fallback_enabled,
        fallback_max_fixtures=settings.api_sports_score_by_id_fallback_max_fixtures,
    )

    usecase = MatchCommandUseCaseImpl(
        match_score_api=score_api,
        uow_factory=lambda: MatchScoreUnitOfWorkImpl(session_factory=session_factory),
    )

    try:
        result = await usecase.check_scores_v2()
        logger.info(
            "celery.task.check_match_scores.completed",
            extra=_task_extra(task, result_type=type(result).__name__),
        )
    except Exception:
        logger.exception("celery.task.check_match_scores.async_failed", extra=_task_extra(task))
        raise
    finally:
        try:
            await client.close()
        except Exception:
            logger.warning("celery.task.check_match_scores.client_close_failed", exc_info=True)
        try:
            await engine.dispose()
        except Exception:
            logger.warning("celery.task.check_match_scores.engine_dispose_failed", exc_info=True)


async def _process_weekly_league_payouts_async(*, task=None):
    import infrastructure.postgresql.models  # noqa: F401 — resolve ORM relationships
    from infrastructure.scheduler.league_payout_scheduler import LeaguePayoutSchedulerImpl

    engine, session_factory = _make_session_factory()
    scheduler = LeaguePayoutSchedulerImpl(session_factory=session_factory)
    run_at = _utc_now_naive()

    try:
        logger.info(
            "league_payout.task_dispatching",
            extra=_task_extra(task, as_of=run_at.isoformat()),
        )
        await scheduler.process_due_payouts(as_of=run_at)
        logger.info(
            "league_payout.task_finished",
            extra=_task_extra(task, as_of=run_at.isoformat()),
        )
    except Exception:
        logger.exception(
            "league_payout.task_failed",
            extra=_task_extra(task, as_of=run_at.isoformat()),
        )
        raise
    finally:
        await engine.dispose()


async def _process_tournaments_scheduler_async(*, task=None):
    import infrastructure.postgresql.models  # noqa: F401 — resolve ORM relationships
    from infrastructure.scheduler.tournament_scheduler import TournamentSchedulerImpl

    engine, session_factory = _make_session_factory()
    scheduler = TournamentSchedulerImpl(session_factory=session_factory)
    run_at = _utc_now_naive()

    try:
        logger.info(
            "tournament_scheduler.task_dispatching",
            extra=_task_extra(task, as_of=run_at.isoformat()),
        )
        await scheduler.process_tournaments(as_of=run_at)
        logger.info(
            "tournament_scheduler.task_finished",
            extra=_task_extra(task, as_of=run_at.isoformat()),
        )
    except Exception:
        logger.exception(
            "tournament_scheduler.task_failed",
            extra=_task_extra(task, as_of=run_at.isoformat()),
        )
        raise
    finally:
        await engine.dispose()



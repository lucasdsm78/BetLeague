import os
import logging
import time

from celery import Celery
from celery.schedules import crontab
from celery.signals import beat_init, setup_logging as celery_setup_logging
from dotenv import load_dotenv
from redis import Redis

from infrastructure.logging_config import resolve_queue_logs_enabled, setup_logging as configure_application_logging

load_dotenv(override=False)

logger = logging.getLogger(__name__)


@celery_setup_logging.connect
def _configure_celery_logging(*_args, **_kwargs) -> None:
    environment = os.getenv("ENVIRONMENT", "dev")
    configure_application_logging(
        environment=environment,
        json_logs=None,
        queue_logs=resolve_queue_logs_enabled(
            environment=environment,
            raw_value=os.getenv("QUEUE_LOGGING_ENABLED"),
        ),
        component=os.getenv("BETLEAGUE_LOG_COMPONENT", "celery"),
    )

CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/1")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/2")

_CELERY_TZ = os.getenv("CELERY_TIMEZONE", "Europe/Paris")
_ENABLE_UTC = os.getenv("CELERY_ENABLE_UTC", "0").strip() in {"1", "true", "True"}

_ENABLE_CATCHUP = os.getenv("CELERY_ENABLE_CATCHUP", "1").strip() in {"1", "true", "True"}
_CATCHUP_THRESHOLD_SECONDS = int(os.getenv("CELERY_CATCHUP_THRESHOLD_SECONDS", "900"))

_ENABLE_FETCH_MATCHES_CATCHUP = os.getenv("CELERY_FETCH_MATCHES_ENABLE_CATCHUP", "1").strip() in {"1", "true", "True"}
_FETCH_MATCHES_CATCHUP_THRESHOLD_SECONDS = int(os.getenv("CELERY_FETCH_MATCHES_CATCHUP_THRESHOLD_SECONDS", str(18 * 3600)))

# Redis state storage (independent from broker)
_STATE_REDIS_URL = os.getenv("CELERY_STATE_REDIS_URL") or CELERY_BROKER_URL
_STATE_PREFIX = os.getenv("CELERY_SCORE_CHECK_STATE_PREFIX", "betleague:celery:score_check")
_STATE_TTL_SECONDS = int(os.getenv("CELERY_SCORE_CHECK_STATE_TTL_SECONDS", str(7 * 24 * 3600)))

_CATCHUP_LOCK_KEY = os.getenv("CELERY_CATCHUP_LOCK_KEY", "betleague:celery:score_check:catchup_lock")
_CATCHUP_LOCK_SECONDS = int(os.getenv("CELERY_CATCHUP_LOCK_SECONDS", "60"))

_FETCH_MATCHES_STATE_PREFIX = os.getenv("CELERY_FETCH_MATCHES_STATE_PREFIX", "betleague:celery:fetch_matches")
_FETCH_MATCHES_CATCHUP_LOCK_KEY = os.getenv("CELERY_FETCH_MATCHES_CATCHUP_LOCK_KEY", "betleague:celery:fetch_matches:catchup_lock")
_FETCH_MATCHES_CATCHUP_LOCK_SECONDS = int(os.getenv("CELERY_FETCH_MATCHES_CATCHUP_LOCK_SECONDS", "60"))

# Backward-compat: old single key name (unused after migration)
_LAST_RUN_KEY = os.getenv("CELERY_LAST_SCORE_CHECK_KEY", "betleague:celery:last_check_match_scores_at")

celery_app = Celery(
    "betleague",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],

    timezone=_CELERY_TZ,
    enable_utc=_ENABLE_UTC,

    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
    worker_hijack_root_logger=False,

    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_default_retry_delay=60,
    task_max_retries=3,

    result_expires=3600,

    beat_schedule={
        "fetch-daily-matches": {
            "task": "infrastructure.celery.tasks.fetch_daily_matches",
            "schedule": crontab(hour=3, minute=0),
        },
        "process-weekly-league-payouts": {
            "task": "infrastructure.celery.tasks.process_weekly_league_payouts",
            "schedule": crontab(day_of_week=1, hour=9, minute=0),
        },
        "process-tournaments-scheduler": {
            "task": "infrastructure.celery.tasks.process_tournaments_scheduler",
            "schedule": crontab(minute="*/5"),
        },
        "check-match-scores": {
            "task": "infrastructure.celery.tasks.check_match_scores",
            "schedule": 300.0,
        },
    },
)


def _redis_state_client() -> Redis:
    return Redis.from_url(
        _STATE_REDIS_URL,
        decode_responses=True,
        socket_connect_timeout=2,
        socket_timeout=2,
    )


def _read_last_finished_epoch() -> int | None:
    """Prefer last_finished_at; fallback to legacy last_run key for smooth rollout."""
    try:
        r = _redis_state_client()
        try:
            raw = r.get(f"{_STATE_PREFIX}:last_finished_at")
            if not raw:
                raw = r.get(_LAST_RUN_KEY)
        finally:
            r.close()
        if not raw:
            return None
        return int(float(raw))
    except Exception:
        logger.exception("celery.beat.catchup.read_last_finished_failed")
        return None


def _read_fetch_matches_last_finished_epoch() -> int | None:
    try:
        r = _redis_state_client()
        try:
            raw = r.get(f"{_FETCH_MATCHES_STATE_PREFIX}:last_finished_at")
        finally:
            r.close()
        if not raw:
            return None
        return int(float(raw))
    except Exception:
        logger.exception("celery.beat.fetch_matches.catchup.read_last_finished_failed")
        return None


def _acquire_catchup_lock() -> bool:
    try:
        r = _redis_state_client()
        try:
            # NX + EX => atomic lock
            return bool(r.set(_CATCHUP_LOCK_KEY, "1", nx=True, ex=_CATCHUP_LOCK_SECONDS))
        finally:
            r.close()
    except Exception:
        # If we can't lock, be conservative: do NOT catch-up to avoid double-run storms.
        logger.exception("celery.beat.catchup.lock_failed", extra={"lock_ttl_s": _CATCHUP_LOCK_SECONDS})
        return False


def _acquire_fetch_matches_catchup_lock() -> bool:
    try:
        r = _redis_state_client()
        try:
            return bool(r.set(_FETCH_MATCHES_CATCHUP_LOCK_KEY, "1", nx=True, ex=_FETCH_MATCHES_CATCHUP_LOCK_SECONDS))
        finally:
            r.close()
    except Exception:
        logger.exception(
            "celery.beat.fetch_matches.catchup.lock_failed",
            extra={"lock_ttl_s": _FETCH_MATCHES_CATCHUP_LOCK_SECONDS},
        )
        return False


@beat_init.connect
def _beat_catchup_on_start(*_args, **_kwargs) -> None:
    now = int(time.time())

    if not _ENABLE_CATCHUP:
        logger.info("celery.beat.catchup.disabled")
    else:
        if not _acquire_catchup_lock():
            logger.info("celery.beat.catchup.lock_skipped")
        else:
            last = _read_last_finished_epoch()

            # Premier demarrage (pas de last_finished): on force un run immediat.
            if last is None:
                logger.info("celery.beat.catchup.first_run_dispatched")
                celery_app.send_task("infrastructure.celery.tasks.check_match_scores")
            else:
                age = now - last
                if age >= _CATCHUP_THRESHOLD_SECONDS:
                    logger.warning(
                        "celery.beat.catchup.dispatched",
                        extra={
                            "age_s": age,
                            "threshold_s": _CATCHUP_THRESHOLD_SECONDS,
                        },
                    )
                    celery_app.send_task("infrastructure.celery.tasks.check_match_scores")
                else:
                    logger.info(
                        "celery.beat.catchup.skipped_recent",
                        extra={
                            "age_s": age,
                            "threshold_s": _CATCHUP_THRESHOLD_SECONDS,
                        },
                    )

    if not _ENABLE_FETCH_MATCHES_CATCHUP:
        logger.info("celery.beat.fetch_matches.catchup.disabled")
        return

    if not _acquire_fetch_matches_catchup_lock():
        logger.info("celery.beat.fetch_matches.catchup.lock_skipped")
        return

    last_fetch = _read_fetch_matches_last_finished_epoch()
    if last_fetch is None:
        logger.info("celery.beat.fetch_matches.catchup.first_run_dispatched")
        celery_app.send_task("infrastructure.celery.tasks.fetch_daily_matches")
        return

    fetch_age = now - last_fetch
    if fetch_age >= _FETCH_MATCHES_CATCHUP_THRESHOLD_SECONDS:
        logger.warning(
            "celery.beat.fetch_matches.catchup.dispatched",
            extra={
                "age_s": fetch_age,
                "threshold_s": _FETCH_MATCHES_CATCHUP_THRESHOLD_SECONDS,
            },
        )
        celery_app.send_task("infrastructure.celery.tasks.fetch_daily_matches")
    else:
        logger.info(
            "celery.beat.fetch_matches.catchup.skipped_recent",
            extra={
                "age_s": fetch_age,
                "threshold_s": _FETCH_MATCHES_CATCHUP_THRESHOLD_SECONDS,
            },
        )


celery_app.autodiscover_tasks(["infrastructure.celery"])

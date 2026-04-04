import os
import logging
import time

from celery import Celery
from celery.schedules import crontab
from celery.signals import beat_init
from dotenv import load_dotenv
from redis import Redis

load_dotenv(override=False)

logger = logging.getLogger(__name__)

CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/1")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/2")

_CELERY_TZ = os.getenv("CELERY_TIMEZONE", "Europe/Paris")
_ENABLE_UTC = os.getenv("CELERY_ENABLE_UTC", "0").strip() in {"1", "true", "True"}

_ENABLE_CATCHUP = os.getenv("CELERY_ENABLE_CATCHUP", "1").strip() in {"1", "true", "True"}
_CATCHUP_THRESHOLD_SECONDS = int(os.getenv("CELERY_CATCHUP_THRESHOLD_SECONDS", "900"))

# Redis state storage (independent from broker)
_STATE_REDIS_URL = os.getenv("CELERY_STATE_REDIS_URL") or CELERY_BROKER_URL
_STATE_PREFIX = os.getenv("CELERY_SCORE_CHECK_STATE_PREFIX", "betleague:celery:score_check")
_STATE_TTL_SECONDS = int(os.getenv("CELERY_SCORE_CHECK_STATE_TTL_SECONDS", str(7 * 24 * 3600)))

_CATCHUP_LOCK_KEY = os.getenv("CELERY_CATCHUP_LOCK_KEY", "betleague:celery:score_check:catchup_lock")
_CATCHUP_LOCK_SECONDS = int(os.getenv("CELERY_CATCHUP_LOCK_SECONDS", "60"))

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
    except Exception as e:
        logger.warning("[CeleryBeatCatchup] Impossible de lire last_finished_at: %s", e)
        return None


def _acquire_catchup_lock() -> bool:
    try:
        r = _redis_state_client()
        try:
            # NX + EX => atomic lock
            return bool(r.set(_CATCHUP_LOCK_KEY, "1", nx=True, ex=_CATCHUP_LOCK_SECONDS))
        finally:
            r.close()
    except Exception as e:
        # If we can't lock, be conservative: do NOT catch-up to avoid double-run storms.
        logger.warning("[CeleryBeatCatchup] lock error (catch-up skipped): %s", e)
        return False


@beat_init.connect
def _beat_catchup_on_start(*_args, **_kwargs) -> None:
    if not _ENABLE_CATCHUP:
        logger.info("[CeleryBeatCatchup] desactive")
        return

    if not _acquire_catchup_lock():
        logger.info("[CeleryBeatCatchup] lock non acquis, skip")
        return

    now = int(time.time())
    last = _read_last_finished_epoch()

    # Premier demarrage (pas de last_finished): on force un run immediat.
    if last is None:
        logger.info("[CeleryBeatCatchup] pas de last_finished, envoi immediat check_match_scores")
        celery_app.send_task("infrastructure.celery.tasks.check_match_scores")
        return

    age = now - last
    if age >= _CATCHUP_THRESHOLD_SECONDS:
        logger.warning(
            "[CeleryBeatCatchup] last_finished trop ancien (%ss >= %ss), envoi immediat check_match_scores",
            age,
            _CATCHUP_THRESHOLD_SECONDS,
        )
        celery_app.send_task("infrastructure.celery.tasks.check_match_scores")
    else:
        logger.info(
            "[CeleryBeatCatchup] last_finished recent (%ss < %ss), pas de catch-up",
            age,
            _CATCHUP_THRESHOLD_SECONDS,
        )


celery_app.autodiscover_tasks(["infrastructure.celery"])

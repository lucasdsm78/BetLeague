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
        "check-match-scores": {
            "task": "infrastructure.celery.tasks.check_match_scores",
            "schedule": 300.0,
        },
    },
)


def _read_last_run_epoch() -> int | None:
    try:
        r = Redis.from_url(
            CELERY_BROKER_URL,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        try:
            raw = r.get(_LAST_RUN_KEY)
        finally:
            r.close()
        if not raw:
            return None
        return int(float(raw))
    except Exception as e:
        logger.warning("[CeleryBeatCatchup] Impossible de lire last_run: %s", e)
        return None


@beat_init.connect
def _beat_catchup_on_start(*_args, **_kwargs) -> None:
    if not _ENABLE_CATCHUP:
        logger.info("[CeleryBeatCatchup] desactive")
        return

    now = int(time.time())
    last = _read_last_run_epoch()

    # Premier demarrage (pas de last_run): on force un run immediat.
    if last is None:
        logger.info("[CeleryBeatCatchup] pas de last_run, envoi immediat check_match_scores")
        celery_app.send_task("infrastructure.celery.tasks.check_match_scores")
        return

    age = now - last
    if age >= _CATCHUP_THRESHOLD_SECONDS:
        logger.warning(
            "[CeleryBeatCatchup] last_run trop ancien (%ss >= %ss), envoi immediat check_match_scores",
            age,
            _CATCHUP_THRESHOLD_SECONDS,
        )
        celery_app.send_task("infrastructure.celery.tasks.check_match_scores")
    else:
        logger.info(
            "[CeleryBeatCatchup] last_run recent (%ss < %ss), pas de catch-up",
            age,
            _CATCHUP_THRESHOLD_SECONDS,
        )


celery_app.autodiscover_tasks(["infrastructure.celery"])

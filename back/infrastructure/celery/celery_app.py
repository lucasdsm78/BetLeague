import os

from celery import Celery
from celery.schedules import crontab
from dotenv import load_dotenv

load_dotenv()

CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/1")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/2")

celery_app = Celery(
    "betleague",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],

    timezone="UTC",
    enable_utc=True,

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

celery_app.autodiscover_tasks(["infrastructure.celery"])

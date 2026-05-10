from __future__ import annotations

import importlib.util
import os
from pathlib import Path


CELERY_APP_PATH = Path(__file__).resolve().parents[1] / "infrastructure" / "celery" / "celery_app.py"


def _load_celery_app_module(monkeypatch, **env_overrides):
    for key in list(os.environ):
        if not key.startswith("CELERY_"):
            continue
        monkeypatch.delenv(key, raising=False)

    for key, value in env_overrides.items():
        monkeypatch.setenv(key, str(value))

    spec = importlib.util.spec_from_file_location("betleague_celery_app_config_test", CELERY_APP_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec is not None and spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_league_payout_schedule_defaults_to_five_minutes(monkeypatch):
    module = _load_celery_app_module(monkeypatch)

    schedule = module.celery_app.conf.beat_schedule.get("process-due-league-payouts")
    assert schedule is not None
    assert schedule["task"] == "infrastructure.celery.tasks.process_weekly_league_payouts"
    assert schedule["schedule"] == 300.0


def test_league_payout_schedule_supports_env_override(monkeypatch):
    module = _load_celery_app_module(monkeypatch, CELERY_LEAGUE_PAYOUT_INTERVAL_SECONDS=60)

    schedule = module.celery_app.conf.beat_schedule.get("process-due-league-payouts")
    assert schedule is not None
    assert schedule["schedule"] == 60.0


def test_league_payout_schedule_falls_back_to_default_when_env_is_invalid(monkeypatch):
    module = _load_celery_app_module(monkeypatch, CELERY_LEAGUE_PAYOUT_INTERVAL_SECONDS="invalid")

    schedule = module.celery_app.conf.beat_schedule.get("process-due-league-payouts")
    assert schedule is not None
    assert schedule["schedule"] == 300.0


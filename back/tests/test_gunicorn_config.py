from __future__ import annotations

import importlib.util
from pathlib import Path


GUNICORN_CONF_PATH = Path(__file__).resolve().parents[1] / "gunicorn.conf.py"



def _load_gunicorn_conf(monkeypatch, **env_overrides):
    for key in [
        "GUNICORN_BIND",
        "GUNICORN_WORKER_CLASS",
        "GUNICORN_FORWARDED_ALLOW_IPS",
        "GUNICORN_WORKERS",
        "WEB_CONCURRENCY",
        "UVICORN_WORKERS",
        "GUNICORN_KEEPALIVE",
        "GUNICORN_TIMEOUT",
        "GUNICORN_GRACEFUL_TIMEOUT",
        "GUNICORN_MAX_REQUESTS",
        "GUNICORN_MAX_REQUESTS_JITTER",
        "GUNICORN_BACKLOG",
        "GUNICORN_LIMIT_REQUEST_LINE",
        "GUNICORN_LIMIT_REQUEST_FIELDS",
        "GUNICORN_LIMIT_REQUEST_FIELD_SIZE",
        "GUNICORN_WORKER_TMP_DIR",
        "GUNICORN_ACCESSLOG",
        "GUNICORN_ERRORLOG",
        "GUNICORN_LOG_LEVEL",
        "GUNICORN_PROC_NAME",
    ]:
        monkeypatch.delenv(key, raising=False)

    for key, value in env_overrides.items():
        monkeypatch.setenv(key, str(value))

    spec = importlib.util.spec_from_file_location("betleague_gunicorn_conf", GUNICORN_CONF_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec is not None and spec.loader is not None
    spec.loader.exec_module(module)
    return module



def test_gunicorn_config_uses_secure_defaults(monkeypatch):
    module = _load_gunicorn_conf(monkeypatch)

    assert module.bind == "0.0.0.0:8000"
    assert module.worker_class == "uvicorn.workers.UvicornWorker"
    assert module.forwarded_allow_ips == "*"
    assert module.workers == 2
    assert module.keepalive == 15
    assert module.timeout == 120
    assert module.graceful_timeout == 15
    assert module.max_requests == 1000
    assert module.max_requests_jitter == 100
    assert module.backlog == 2048
    assert module.limit_request_line == 4094
    assert module.limit_request_fields == 100
    assert module.limit_request_field_size == 8190
    assert module.worker_tmp_dir == "/dev/shm"
    assert module.accesslog == "-"
    assert module.errorlog == "-"
    assert module.loglevel == "info"
    assert module.capture_output is True
    assert module.proc_name == "betleague-api"



def test_gunicorn_workers_prefers_explicit_env(monkeypatch):
    module = _load_gunicorn_conf(
        monkeypatch,
        GUNICORN_WORKERS=4,
        WEB_CONCURRENCY=3,
        UVICORN_WORKERS=2,
    )

    assert module.workers == 4



def test_gunicorn_workers_supports_legacy_uvicorn_workers_fallback(monkeypatch):
    module = _load_gunicorn_conf(monkeypatch, UVICORN_WORKERS=5)

    assert module.workers == 5


def test_gunicorn_forwarded_allow_ips_supports_explicit_env(monkeypatch):
    module = _load_gunicorn_conf(monkeypatch, GUNICORN_FORWARDED_ALLOW_IPS="10.0.0.10,10.0.0.11")

    assert module.forwarded_allow_ips == "10.0.0.10,10.0.0.11"




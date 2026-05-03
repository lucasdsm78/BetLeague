import os
import sys
from pathlib import Path



def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    return int(raw)


bind = os.getenv("GUNICORN_BIND", "0.0.0.0:8000")
worker_class = os.getenv("GUNICORN_WORKER_CLASS", "uvicorn.workers.UvicornWorker")
forwarded_allow_ips = os.getenv("GUNICORN_FORWARDED_ALLOW_IPS", "*")
workers = _env_int(
    "GUNICORN_WORKERS",
    _env_int("WEB_CONCURRENCY", _env_int("UVICORN_WORKERS", 2)),
)
keepalive = _env_int("GUNICORN_KEEPALIVE", 15)
timeout = _env_int("GUNICORN_TIMEOUT", 120)
graceful_timeout = _env_int("GUNICORN_GRACEFUL_TIMEOUT", 15)
max_requests = _env_int("GUNICORN_MAX_REQUESTS", 1000)
max_requests_jitter = _env_int("GUNICORN_MAX_REQUESTS_JITTER", 100)
backlog = _env_int("GUNICORN_BACKLOG", 2048)
limit_request_line = _env_int("GUNICORN_LIMIT_REQUEST_LINE", 4094)
limit_request_fields = _env_int("GUNICORN_LIMIT_REQUEST_FIELDS", 100)
limit_request_field_size = _env_int("GUNICORN_LIMIT_REQUEST_FIELD_SIZE", 8190)
worker_tmp_dir = os.getenv("GUNICORN_WORKER_TMP_DIR", "/dev/shm")
accesslog = os.getenv("GUNICORN_ACCESSLOG", "-")
errorlog = os.getenv("GUNICORN_ERRORLOG", "-")
loglevel = os.getenv("GUNICORN_LOG_LEVEL", "info")
capture_output = True
proc_name = os.getenv("GUNICORN_PROC_NAME", "betleague-api")
preload_app = False

access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'


def _prometheus_multiproc_dir() -> Path | None:
    raw_path = os.getenv("PROMETHEUS_MULTIPROC_DIR", "").strip()
    if not raw_path:
        return None

    path = Path(raw_path).resolve()
    if path == Path(path.anchor):
        raise RuntimeError("PROMETHEUS_MULTIPROC_DIR must not point to a filesystem root")
    return path


def _prometheus_multiproc_fallback_dir() -> Path:
    base_dir = Path(worker_tmp_dir).resolve()
    if base_dir == Path(base_dir.anchor):
        raise RuntimeError("GUNICORN_WORKER_TMP_DIR must not point to a filesystem root when used for Prometheus multiprocess metrics")
    return base_dir / "prometheus-multiproc"


def _ensure_prometheus_dir_is_writable(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)
    probe = path / ".betleague-prometheus-write-test"
    probe.touch(exist_ok=True)
    probe.unlink(missing_ok=True)


def _resolve_prometheus_multiproc_dir_for_startup() -> Path | None:
    configured_dir = _prometheus_multiproc_dir()
    if configured_dir is None:
        return None

    try:
        _ensure_prometheus_dir_is_writable(configured_dir)
        return configured_dir
    except OSError as configured_error:
        fallback_dir = _prometheus_multiproc_fallback_dir()
        if fallback_dir == configured_dir:
            raise RuntimeError(
                f"PROMETHEUS_MULTIPROC_DIR '{configured_dir}' is not writable and no distinct fallback is available"
            ) from configured_error

        try:
            _ensure_prometheus_dir_is_writable(fallback_dir)
        except OSError as fallback_error:
            raise RuntimeError(
                f"PROMETHEUS_MULTIPROC_DIR '{configured_dir}' is not writable and fallback '{fallback_dir}' also failed"
            ) from fallback_error

        os.environ["PROMETHEUS_MULTIPROC_DIR"] = str(fallback_dir)
        print(
            (
                f"[betleague] PROMETHEUS_MULTIPROC_DIR '{configured_dir}' is not writable; "
                f"falling back to '{fallback_dir}'."
            ),
            file=sys.stderr,
        )
        return fallback_dir


def on_starting(_server):
    prometheus_dir = _resolve_prometheus_multiproc_dir_for_startup()
    if prometheus_dir is None:
        return

    for metrics_file in prometheus_dir.glob("*.db"):
        if metrics_file.is_file():
            metrics_file.unlink()


def child_exit(_server, worker):
    if _prometheus_multiproc_dir() is None:
        return

    from prometheus_client import multiprocess

    multiprocess.mark_process_dead(worker.pid)




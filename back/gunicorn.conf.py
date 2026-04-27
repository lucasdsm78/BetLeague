import os



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
worker_tmp_dir = os.getenv("GUNICORN_WORKER_TMP_DIR", "/tmp")
accesslog = os.getenv("GUNICORN_ACCESSLOG", "-")
errorlog = os.getenv("GUNICORN_ERRORLOG", "-")
loglevel = os.getenv("GUNICORN_LOG_LEVEL", "info")
capture_output = True
proc_name = os.getenv("GUNICORN_PROC_NAME", "betleague-api")
preload_app = False

access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'




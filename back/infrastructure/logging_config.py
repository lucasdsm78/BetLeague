from __future__ import annotations

import json
import logging
import os
import re
from collections.abc import Mapping
from datetime import datetime, timezone

from infrastructure.logging_context import RequestContextFilter


_RESERVED_LOG_RECORD_FIELDS = set(logging.makeLogRecord({}).__dict__.keys())
_TOP_LEVEL_LOG_FIELDS = {"request_id"}
_REDACTED = "[REDACTED]"


def _normalize_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (value or "").lower())


def _is_sensitive_key(key: str | None) -> bool:
    normalized = _normalize_key(key or "")
    if not normalized:
        return False
    if normalized.endswith("email") and not normalized.endswith("emailhash"):
        return True
    sensitive_parts = (
        "password",
        "passwd",
        "token",
        "authorization",
        "cookie",
        "secret",
    )
    return any(part in normalized for part in sensitive_parts)


def _sanitize_log_value(value, *, key: str | None = None):
    if _is_sensitive_key(key):
        return _REDACTED
    if isinstance(value, Mapping):
        return {
            item_key: _sanitize_log_value(item_value, key=str(item_key))
            for item_key, item_value in value.items()
        }
    if isinstance(value, list):
        return [_sanitize_log_value(item, key=key) for item in value]
    if isinstance(value, tuple):
        return tuple(_sanitize_log_value(item, key=key) for item in value)
    if isinstance(value, set):
        return {_sanitize_log_value(item, key=key) for item in value}
    return value


class SensitiveDataRedactionFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        for key, value in list(record.__dict__.items()):
            if key in _RESERVED_LOG_RECORD_FIELDS or key.startswith("_"):
                continue
            record.__dict__[key] = _sanitize_log_value(value, key=key)
        return True


class JsonFormatter(logging.Formatter):
    def __init__(self, *, service_name: str, environment: str, component: str):
        super().__init__()
        self._service_name = service_name
        self._environment = environment
        self._component = component

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "service": self._service_name,
            "component": self._component,
            "env": self._environment,
            "msg": record.getMessage(),
        }
        request_id = getattr(record, "request_id", None)
        if request_id and request_id != "-":
            payload["request_id"] = request_id
        extra = {
            key: value
            for key, value in record.__dict__.items()
            if key not in _RESERVED_LOG_RECORD_FIELDS and key not in _TOP_LEVEL_LOG_FIELDS and not key.startswith("_")
        }
        if extra:
            payload["context"] = extra
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, separators=(",", ":"), ensure_ascii=False, default=str)


def setup_logging(
    *,
    environment: str = "dev",
    json_logs: bool | None = None,
    component: str = "app",
    service_name: str | None = None,
) -> None:
    if json_logs is None:
        raw_json_logs = os.getenv("JSON_LOGS")
        if raw_json_logs is None:
            json_logs = environment == "prod"
        else:
            json_logs = raw_json_logs.lower() in {"1", "true", "yes"}

    service_name = (service_name or os.getenv("LOG_SERVICE_NAME") or "betleague-back").strip() or "betleague-back"
    component = (component or "app").strip() or "app"

    root = logging.getLogger()
    # En dev: root DEBUG pour éviter qu'une config Uvicorn ne filtre nos DEBUG.
    # En prod: root INFO.
    root.setLevel(logging.DEBUG if environment != "prod" else logging.INFO)

    for h in list(root.handlers):
        root.removeHandler(h)

    handler = logging.StreamHandler()
    handler.addFilter(RequestContextFilter())
    handler.addFilter(SensitiveDataRedactionFilter())
    if json_logs:
        handler.setFormatter(
            JsonFormatter(
                service_name=service_name,
                environment=environment,
                component=component,
            )
        )
    else:
        handler.setFormatter(
            logging.Formatter(
                f"%(levelname)s:%(name)s:%(message)s [service={service_name} component={component} env={environment} request_id=%(request_id)s]"
            )
        )

    # Le handler accepte DEBUG en dev, INFO en prod.
    handler.setLevel(logging.DEBUG if environment != "prod" else logging.INFO)
    root.addHandler(handler)

    if environment != "prod":
        # Réduire le bruit en dev
        logging.getLogger("uvicorn.access").setLevel(logging.INFO)
        logging.getLogger("uvicorn.error").setLevel(logging.INFO)
        logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
        logging.getLogger("sqlalchemy.pool").setLevel(logging.WARNING)

    if environment == "prod":
        logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
        logging.getLogger("sqlalchemy.pool").setLevel(logging.WARNING)
        logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
        logging.getLogger("uvicorn.error").setLevel(logging.INFO)

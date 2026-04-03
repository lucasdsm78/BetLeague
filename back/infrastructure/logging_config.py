from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone


_RESERVED_LOG_RECORD_FIELDS = set(logging.makeLogRecord({}).__dict__.keys())


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        extra = {
            key: value
            for key, value in record.__dict__.items()
            if key not in _RESERVED_LOG_RECORD_FIELDS and not key.startswith("_")
        }
        if extra:
            payload["context"] = extra
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, separators=(",", ":"))


def setup_logging(*, environment: str = "dev", json_logs: bool | None = None) -> None:
    if json_logs is None:
        json_logs = os.getenv("JSON_LOGS", "false").lower() in {"1", "true", "yes"}

    root = logging.getLogger()
    # En dev: root DEBUG pour éviter qu'une config Uvicorn ne filtre nos DEBUG.
    # En prod: root INFO.
    root.setLevel(logging.DEBUG if environment != "prod" else logging.INFO)

    for h in list(root.handlers):
        root.removeHandler(h)

    handler = logging.StreamHandler()
    if json_logs:
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(logging.Formatter("%(levelname)s:%(name)s:%(message)s"))

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
        logging.getLogger("uvicorn.access").setLevel(logging.INFO)
        logging.getLogger("uvicorn.error").setLevel(logging.INFO)

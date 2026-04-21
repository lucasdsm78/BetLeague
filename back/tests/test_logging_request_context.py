from __future__ import annotations

import json
import logging
from logging.handlers import QueueHandler
from types import SimpleNamespace

from fastapi import FastAPI, HTTPException, Request
from fastapi.testclient import TestClient

from infrastructure.http_exception_handlers import register_exception_handlers
from infrastructure.logging_config import JsonFormatter, SensitiveDataRedactionFilter, setup_logging, shutdown_logging
from infrastructure.logging_context import RequestContextFilter, reset_request_id, set_request_id
from infrastructure.logging_middleware import RequestLoggingMiddleware


class _ListHandler(logging.Handler):
    def __init__(self):
        super().__init__()
        self.records: list[logging.LogRecord] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.records.append(record)


def _settings() -> SimpleNamespace:
    return SimpleNamespace(
        http_request_logging_enabled=True,
        http_request_logging_excluded_paths_list=["/health"],
        http_slow_request_threshold_ms=1000,
        trusted_proxy_ips_list=[],
    )


def test_request_context_filter_preserves_explicit_request_id():
    filter_ = RequestContextFilter()
    token = set_request_id("ctx-request-id")
    try:
        record = logging.makeLogRecord({"msg": "hello", "request_id": "explicit-request-id"})
        assert filter_.filter(record) is True
        assert record.request_id == "explicit-request-id"
    finally:
        reset_request_id(token)



def test_request_logging_middleware_echoes_and_logs_request_id():
    app = FastAPI()
    app.add_middleware(RequestLoggingMiddleware, settings=_settings())

    @app.get("/ping")
    async def ping():
        return {"ok": True}

    handler = _ListHandler()
    handler.addFilter(RequestContextFilter())
    logger = logging.getLogger("infrastructure.logging_middleware")
    logger.addHandler(handler)
    logger.setLevel(logging.DEBUG)

    try:
        client = TestClient(app)
        response = client.get("/ping", headers={"X-Request-Id": "front-req-123"})
    finally:
        logger.removeHandler(handler)

    assert response.status_code == 200
    assert response.headers["x-request-id"] == "front-req-123"

    started = [record for record in handler.records if record.getMessage() == "http.request.started"]
    completed = [record for record in handler.records if record.getMessage() == "http.request.completed"]
    assert started, "Expected http.request.started log"
    assert completed, "Expected http.request.completed log"
    assert started[-1].request_id == "front-req-123"
    assert started[-1].method == "GET"
    assert started[-1].path == "/ping"
    assert started[-1].route_path == "/ping"
    assert completed[-1].request_id == "front-req-123"
    assert completed[-1].status_code == 200
    assert completed[-1].route_path == "/ping"


def test_request_logging_middleware_adds_user_id_when_present_in_request_state():
    app = FastAPI()
    app.add_middleware(RequestLoggingMiddleware, settings=_settings())

    @app.get("/me")
    async def me(request: Request):
        request.state.user_id = 42
        return {"ok": True}

    handler = _ListHandler()
    handler.addFilter(RequestContextFilter())
    logger = logging.getLogger("infrastructure.logging_middleware")
    logger.addHandler(handler)
    logger.setLevel(logging.DEBUG)

    try:
        client = TestClient(app)
        response = client.get("/me", headers={"X-Request-Id": "req-user-42"})
    finally:
        logger.removeHandler(handler)

    assert response.status_code == 200

    completed = [record for record in handler.records if record.getMessage() == "http.request.completed"]
    assert completed, "Expected http.request.completed log"
    assert completed[-1].user_id == 42


def test_request_logging_middleware_skips_excluded_paths():
    app = FastAPI()
    app.add_middleware(RequestLoggingMiddleware, settings=_settings())

    @app.get("/health")
    async def health():
        return {"ok": True}

    handler = _ListHandler()
    handler.addFilter(RequestContextFilter())
    logger = logging.getLogger("infrastructure.logging_middleware")
    logger.addHandler(handler)
    logger.setLevel(logging.DEBUG)

    try:
        client = TestClient(app)
        response = client.get("/health")
    finally:
        logger.removeHandler(handler)

    assert response.status_code == 200
    assert [record for record in handler.records if record.getMessage().startswith("http.request.")] == []


def test_validation_handler_logs_and_returns_request_id():
    app = FastAPI()
    settings = _settings()
    register_exception_handlers(app, settings=settings)
    app.add_middleware(RequestLoggingMiddleware, settings=settings)

    @app.get("/validate")
    async def validate(count: int):
        return {"count": count}

    handler = _ListHandler()
    handler.addFilter(RequestContextFilter())
    logger = logging.getLogger("infrastructure.http_exception_handlers")
    logger.addHandler(handler)
    logger.setLevel(logging.DEBUG)

    try:
        client = TestClient(app)
        response = client.get("/validate?count=nope", headers={"X-Request-Id": "req-422"})
    finally:
        logger.removeHandler(handler)

    assert response.status_code == 422
    assert response.headers["x-request-id"] == "req-422"
    assert response.json()["detail"]

    validation_logs = [record for record in handler.records if record.getMessage() == "http.validation.failed"]
    assert validation_logs, "Expected http.validation.failed log"
    assert validation_logs[-1].request_id == "req-422"
    assert validation_logs[-1].status_code == 422


def test_http_exception_handler_logs_and_preserves_request_id():
    app = FastAPI()
    settings = _settings()
    register_exception_handlers(app, settings=settings)
    app.add_middleware(RequestLoggingMiddleware, settings=settings)

    @app.get("/missing")
    async def missing():
        raise HTTPException(status_code=404, detail="Not found")

    handler = _ListHandler()
    handler.addFilter(RequestContextFilter())
    logger = logging.getLogger("infrastructure.http_exception_handlers")
    logger.addHandler(handler)
    logger.setLevel(logging.DEBUG)

    try:
        client = TestClient(app)
        response = client.get("/missing", headers={"X-Request-Id": "req-404"})
    finally:
        logger.removeHandler(handler)

    assert response.status_code == 404
    assert response.headers["x-request-id"] == "req-404"
    assert response.json() == {"detail": "Not found"}

    handled_logs = [record for record in handler.records if record.getMessage() == "http.exception.handled"]
    assert handled_logs, "Expected http.exception.handled log"
    assert handled_logs[-1].request_id == "req-404"
    assert handled_logs[-1].status_code == 404


def test_unhandled_exception_handler_returns_500_and_request_id():
    app = FastAPI()
    settings = _settings()
    register_exception_handlers(app, settings=settings)
    app.add_middleware(RequestLoggingMiddleware, settings=settings)

    @app.get("/boom")
    async def boom():
        raise RuntimeError("boom")

    handler = _ListHandler()
    handler.addFilter(RequestContextFilter())
    logger = logging.getLogger("infrastructure.http_exception_handlers")
    logger.addHandler(handler)
    logger.setLevel(logging.DEBUG)

    try:
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/boom", headers={"X-Request-Id": "req-500"})
    finally:
        logger.removeHandler(handler)

    assert response.status_code == 500
    assert response.headers["x-request-id"] == "req-500"
    assert response.json() == {"detail": "Internal server error"}

    unhandled_logs = [record for record in handler.records if record.getMessage() == "http.exception.unhandled"]
    assert unhandled_logs, "Expected http.exception.unhandled log"
    assert unhandled_logs[-1].request_id == "req-500"
    assert unhandled_logs[-1].status_code == 500


def test_request_logging_middleware_logs_failed_for_5xx_responses():
    app = FastAPI()
    settings = _settings()
    register_exception_handlers(app, settings=settings)
    app.add_middleware(RequestLoggingMiddleware, settings=settings)

    @app.get("/boom")
    async def boom():
        raise RuntimeError("boom")

    handler = _ListHandler()
    handler.addFilter(RequestContextFilter())
    logger = logging.getLogger("infrastructure.logging_middleware")
    logger.addHandler(handler)
    logger.setLevel(logging.DEBUG)

    try:
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/boom", headers={"X-Request-Id": "req-failed-500"})
    finally:
        logger.removeHandler(handler)

    assert response.status_code == 500
    failed = [record for record in handler.records if record.getMessage() == "http.request.failed"]
    completed = [record for record in handler.records if record.getMessage() == "http.request.completed"]
    assert failed, "Expected http.request.failed log"
    assert completed == []
    assert failed[-1].request_id == "req-failed-500"
    assert failed[-1].status_code == 500
    assert failed[-1].path == "/boom"
    assert failed[-1].route_path == "/boom"


def test_sensitive_data_redaction_filter_masks_nested_sensitive_fields():
    record = logging.makeLogRecord(
        {
            "msg": "auth.login.failed",
            "token": "secret-token",
            "email": "user@example.com",
            "email_hash": "safe-hash",
            "context": {
                "authorization": "Bearer abc",
                "nested": {"refresh_token": "refresh-secret", "ok": True},
            },
        }
    )

    filter_ = SensitiveDataRedactionFilter()
    assert filter_.filter(record) is True

    formatter = JsonFormatter(service_name="betleague-back", environment="test", component="api")
    payload = json.loads(formatter.format(record))

    assert payload["context"]["token"] == "[REDACTED]"
    assert payload["context"]["email"] == "[REDACTED]"
    assert payload["context"]["email_hash"] == "safe-hash"
    assert payload["context"]["context"]["authorization"] == "[REDACTED]"
    assert payload["context"]["context"]["nested"]["refresh_token"] == "[REDACTED]"
    assert payload["context"]["context"]["nested"]["ok"] is True


def test_setup_logging_can_enable_queue_handler_and_shutdown_cleanly():
    root = logging.getLogger()
    original_handlers = list(root.handlers)
    original_level = root.level

    try:
        setup_logging(
            environment="prod",
            json_logs=True,
            component="test",
            queue_logs=True,
        )

        assert root.handlers, "Expected root logger to have handlers configured"
        assert any(isinstance(handler, QueueHandler) for handler in root.handlers)

        logging.getLogger("tests.queue_logging").info("logging.queue.enabled")
    finally:
        shutdown_logging()
        for handler in list(root.handlers):
            root.removeHandler(handler)
        for handler in original_handlers:
            root.addHandler(handler)
        root.setLevel(original_level)







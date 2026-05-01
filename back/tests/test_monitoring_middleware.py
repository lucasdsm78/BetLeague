from __future__ import annotations

import asyncio
from types import SimpleNamespace

from infrastructure.monitoring import PrometheusMiddleware


async def _receive():
    return {"type": "http.request", "body": b"", "more_body": False}


def test_metrics_is_served_before_inner_middlewares_for_task_ip_host():
    async def inner_app(_scope, _receive, _send):
        raise AssertionError("/metrics must be served before inner middlewares such as TrustedHostMiddleware")

    app = PrometheusMiddleware(
        inner_app,
        settings=SimpleNamespace(celery_metrics_enabled=False),
    )
    messages = []

    async def send(message):
        messages.append(message)

    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": "/metrics",
        "raw_path": b"/metrics",
        "query_string": b"",
        "headers": [(b"host", b"10.0.2.15:8000")],
    }

    asyncio.run(app(scope, _receive, send))

    response_start = next(message for message in messages if message["type"] == "http.response.start")
    response_body = b"".join(
        message.get("body", b"")
        for message in messages
        if message["type"] == "http.response.body"
    )

    assert response_start["status"] == 200
    assert b"# HELP" in response_body


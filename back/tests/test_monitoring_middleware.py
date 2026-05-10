from __future__ import annotations

import asyncio
from types import SimpleNamespace

import infrastructure.monitoring as monitoring_module
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


def test_metrics_includes_overdue_leagues_gauge(monkeypatch):
    async def inner_app(_scope, _receive, _send):
        raise AssertionError("/metrics must be served before inner middlewares")

    async def fake_scrape_overdue(_settings):
        monitoring_module.OVERDUE_LEAGUES.set(2)
        monitoring_module.OVERDUE_LEAGUES_SCRAPE_SUCCESS.set(1)

    monkeypatch.setattr(monitoring_module, "_scrape_celery_queue_depth", lambda _settings: None)
    monkeypatch.setattr(monitoring_module, "_scrape_overdue_leagues", fake_scrape_overdue)

    app = PrometheusMiddleware(
        inner_app,
        settings=SimpleNamespace(
            celery_metrics_enabled=False,
            league_payout_metrics_enabled=True,
            league_payout_metrics_scrape_interval_s=0,
            league_payout_overdue_threshold_minutes=15,
        ),
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
        "headers": [(b"host", b"127.0.0.1:8000")],
    }

    asyncio.run(app(scope, _receive, send))

    response_body = b"".join(
        message.get("body", b"")
        for message in messages
        if message["type"] == "http.response.body"
    )

    assert b"betleague_overdue_leagues " in response_body
    assert b"betleague_overdue_leagues 2.0" in response_body
    assert b"betleague_overdue_leagues_scrape_success 1.0" in response_body



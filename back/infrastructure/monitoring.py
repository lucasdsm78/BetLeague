from __future__ import annotations

import os
import time
from typing import Any

from fastapi import FastAPI, Response
from prometheus_client import CONTENT_TYPE_LATEST, CollectorRegistry, Counter, Gauge, Histogram, generate_latest, multiprocess
from redis import Redis


HTTP_REQUESTS_TOTAL = Counter(
    "betleague_http_requests_total",
    "Nombre total de requêtes HTTP servies par l'API BetLeague.",
    ("method", "route", "status_code"),
)

HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "betleague_http_request_duration_seconds",
    "Latence HTTP de l'API BetLeague.",
    ("method", "route"),
    buckets=(0.025, 0.05, 0.1, 0.2, 0.3, 0.5, 0.75, 1.0, 2.5, 5.0, 10.0),
)

HTTP_REQUESTS_IN_PROGRESS = Gauge(
    "betleague_http_requests_in_progress",
    "Nombre de requêtes HTTP actuellement en cours sur l'API BetLeague.",
    multiprocess_mode="livesum",
)

CELERY_QUEUE_DEPTH = Gauge(
    "betleague_celery_queue_depth",
    "Nombre de messages en attente par queue Celery Redis.",
    ("queue",),
    multiprocess_mode="livemostrecent",
)

CELERY_QUEUE_SCRAPE_SUCCESS = Gauge(
    "betleague_celery_queue_scrape_success",
    "Indique si le dernier relevé des queues Celery Redis a réussi (1) ou échoué (0).",
    multiprocess_mode="livemostrecent",
)

METRICS_EXCLUDED_PATHS = frozenset({"/health", "/metrics", "/ready"})
_last_celery_queue_scrape_at = 0.0


def _route_path(scope: dict[str, Any]) -> str:
    route = scope.get("route")
    route_path = getattr(route, "path", None)
    if route_path:
        return route_path
    return "__unmatched__"


class PrometheusMiddleware:
    def __init__(self, app, *, settings: Any):
        self.app = app
        self.settings = settings

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        if scope.get("path") == "/metrics":
            try:
                _scrape_celery_queue_depth(self.settings)
            except Exception:
                pass
            response = Response(content=_generate_metrics_payload(), media_type=CONTENT_TYPE_LATEST)
            await response(scope, receive, send)
            return

        if scope.get("path") in METRICS_EXCLUDED_PATHS:
            await self.app(scope, receive, send)
            return

        method = scope.get("method", "GET").upper()
        started_at = time.perf_counter()
        status_code = "500"

        async def send_wrapper(message):
            nonlocal status_code
            if message.get("type") == "http.response.start":
                status_code = str(message.get("status", 500))
            await send(message)

        HTTP_REQUESTS_IN_PROGRESS.inc()
        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            HTTP_REQUESTS_IN_PROGRESS.dec()
            route = _route_path(scope)
            duration = time.perf_counter() - started_at
            HTTP_REQUEST_DURATION_SECONDS.labels(method=method, route=route).observe(duration)
            HTTP_REQUESTS_TOTAL.labels(method=method, route=route, status_code=status_code).inc()


def _scrape_celery_queue_depth(settings: Any) -> None:
    global _last_celery_queue_scrape_at

    if not bool(getattr(settings, "celery_metrics_enabled", True)):
        CELERY_QUEUE_SCRAPE_SUCCESS.set(1)
        return

    now = time.monotonic()
    min_interval = max(1.0, float(getattr(settings, "celery_metrics_scrape_interval_s", 15)))
    if now - _last_celery_queue_scrape_at < min_interval:
        return

    queues = getattr(settings, "celery_metrics_queues_list", None) or ["celery"]
    broker_url = getattr(settings, "celery_broker_url", "redis://localhost:6379/1")
    timeout = max(0.1, float(getattr(settings, "celery_metrics_redis_timeout_s", 0.5)))
    client = Redis.from_url(
        broker_url,
        decode_responses=True,
        socket_connect_timeout=timeout,
        socket_timeout=timeout,
    )
    try:
        for queue_name in queues:
            CELERY_QUEUE_DEPTH.labels(queue=queue_name).set(client.llen(queue_name))
        CELERY_QUEUE_SCRAPE_SUCCESS.set(1)
        _last_celery_queue_scrape_at = now
    except Exception:
        CELERY_QUEUE_SCRAPE_SUCCESS.set(0)
        raise
    finally:
        client.close()


def _generate_metrics_payload() -> bytes:
    if not os.getenv("PROMETHEUS_MULTIPROC_DIR"):
        return generate_latest()

    registry = CollectorRegistry()
    multiprocess.MultiProcessCollector(registry)
    return generate_latest(registry)


def register_monitoring(app: FastAPI, *, settings: Any) -> None:
    app.add_middleware(PrometheusMiddleware, settings=settings)

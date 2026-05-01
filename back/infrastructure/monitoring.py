from __future__ import annotations

import time
from typing import Any

from fastapi import FastAPI, Request, Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest
from redis import Redis
from starlette.middleware.base import BaseHTTPMiddleware


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
)

CELERY_QUEUE_DEPTH = Gauge(
    "betleague_celery_queue_depth",
    "Nombre de messages en attente par queue Celery Redis.",
    ("queue",),
)

CELERY_QUEUE_SCRAPE_SUCCESS = Gauge(
    "betleague_celery_queue_scrape_success",
    "Indique si le dernier relevé des queues Celery Redis a réussi (1) ou échoué (0).",
)

METRICS_EXCLUDED_PATHS = frozenset({"/metrics"})


def _route_path(request: Request) -> str:
    route = request.scope.get("route")
    route_path = getattr(route, "path", None)
    if route_path:
        return route_path
    return request.url.path or "/"


class PrometheusMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        route = _route_path(request)
        if route in METRICS_EXCLUDED_PATHS:
            return await call_next(request)

        method = request.method.upper()
        started_at = time.perf_counter()
        HTTP_REQUESTS_IN_PROGRESS.inc()
        try:
            response = await call_next(request)
        except Exception:
            duration = time.perf_counter() - started_at
            HTTP_REQUEST_DURATION_SECONDS.labels(method=method, route=route).observe(duration)
            HTTP_REQUESTS_TOTAL.labels(method=method, route=route, status_code="500").inc()
            raise
        finally:
            HTTP_REQUESTS_IN_PROGRESS.dec()

        duration = time.perf_counter() - started_at
        HTTP_REQUEST_DURATION_SECONDS.labels(method=method, route=route).observe(duration)
        HTTP_REQUESTS_TOTAL.labels(method=method, route=route, status_code=str(response.status_code)).inc()
        return response


def _scrape_celery_queue_depth(settings: Any) -> None:
    queues = getattr(settings, "celery_metrics_queues_list", None) or ["celery"]
    broker_url = getattr(settings, "celery_broker_url", "redis://localhost:6379/1")
    client = Redis.from_url(
        broker_url,
        decode_responses=True,
        socket_connect_timeout=2,
        socket_timeout=2,
    )
    try:
        for queue_name in queues:
            CELERY_QUEUE_DEPTH.labels(queue=queue_name).set(client.llen(queue_name))
        CELERY_QUEUE_SCRAPE_SUCCESS.set(1)
    except Exception:
        CELERY_QUEUE_SCRAPE_SUCCESS.set(0)
        raise
    finally:
        client.close()


def register_monitoring(app: FastAPI, *, settings: Any) -> None:
    app.add_middleware(PrometheusMiddleware)

    @app.get("/metrics", include_in_schema=False)
    async def metrics() -> Response:
        try:
            _scrape_celery_queue_depth(settings)
        except Exception:
            pass
        return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


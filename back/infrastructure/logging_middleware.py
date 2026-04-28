from __future__ import annotations

import logging
import time
from typing import Any
from uuid import uuid4

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from infrastructure.config import Settings
from infrastructure.logging_context import reset_request_id, set_request_id
from infrastructure.security.request_ip import get_request_client_ip


logger = logging.getLogger(__name__)

_REQUEST_ID_ALLOWED_CHARS = frozenset("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.:")


def _normalize_request_id(raw_value: str | None) -> str:
    candidate = (raw_value or "").strip()
    if 0 < len(candidate) <= 128 and all(char in _REQUEST_ID_ALLOWED_CHARS for char in candidate):
        return candidate
    return uuid4().hex


def _route_path(request: Request) -> str | None:
    route = request.scope.get("route")
    return getattr(route, "path", None) or request.url.path


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, *, settings: Settings):
        super().__init__(app)
        self.settings = settings

    def _is_enabled(self) -> bool:
        return bool(getattr(self.settings, "http_request_logging_enabled", True))

    def _excluded_paths(self) -> set[str]:
        return set(getattr(self.settings, "http_request_logging_excluded_paths_list", ["/health"]))

    def _slow_request_threshold_ms(self) -> int:
        return int(getattr(self.settings, "http_slow_request_threshold_ms", 1000))

    @staticmethod
    def _request_user_id(request: Request):
        return getattr(getattr(request, "state", None), "user_id", None)

    def _request_log_extra(self, request: Request, *, request_id: str, client_ip: str, **extra: Any) -> dict[str, Any]:
        payload = {
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "route_path": _route_path(request),
            "client_ip": client_ip,
        }
        for key, value in extra.items():
            if value is not None:
                payload[key] = value
        return payload

    async def dispatch(self, request: Request, call_next):
        if not self._is_enabled() or request.url.path in self._excluded_paths():
            return await call_next(request)

        request_id = _normalize_request_id(request.headers.get("X-Request-Id"))
        request.state.request_id = request_id

        token = set_request_id(request_id)
        started_at = time.perf_counter()
        client_ip = get_request_client_ip(request, self.settings)

        logger.info(
            "http.request.started",
            extra=self._request_log_extra(
                request,
                request_id=request_id,
                client_ip=client_ip,
            ),
        )

        try:
            response = await call_next(request)
        except Exception as exc:
            duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
            logger.exception(
                "http.request.failed",
                extra=self._request_log_extra(
                    request,
                    request_id=request_id,
                    client_ip=client_ip,
                    user_id=self._request_user_id(request),
                    status_code=500,
                    duration_ms=duration_ms,
                    exception_type=type(exc).__name__,
                ),
            )
            raise
        finally:
            reset_request_id(token)

        response.headers.setdefault("X-Request-Id", request_id)

        duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
        threshold_ms = self._slow_request_threshold_ms()
        response_extra = self._request_log_extra(
            request,
            request_id=request_id,
            client_ip=client_ip,
            user_id=self._request_user_id(request),
            status_code=response.status_code,
            duration_ms=duration_ms,
        )
        if response.status_code >= 500:
            logger.error("http.request.failed", extra=response_extra)
            return response

        level = logging.WARNING if duration_ms >= threshold_ms else logging.INFO
        logger.log(level, "http.request.completed", extra=response_extra)
        return response




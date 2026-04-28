from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from infrastructure.config import Settings
from infrastructure.security.request_ip import get_request_client_ip


logger = logging.getLogger(__name__)


def _request_log_extra(request: Request, settings: Settings, **extra: Any) -> dict[str, Any]:
    request_id = getattr(request.state, "request_id", None)
    payload = {
        "request_id": request_id,
        "method": request.method,
        "path": request.url.path,
        "client_ip": get_request_client_ip(request, settings),
        "user_id": getattr(request.state, "user_id", None),
    }
    for key, value in extra.items():
        if value is not None:
            payload[key] = value
    return payload


def _json_response(request: Request, status_code: int, content: Any) -> JSONResponse:
    response = JSONResponse(status_code=status_code, content=content)
    request_id = getattr(request.state, "request_id", None)
    if request_id:
        response.headers.setdefault("X-Request-Id", request_id)
    return response


def register_exception_handlers(app: FastAPI, *, settings: Settings) -> None:
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        log_level = logging.WARNING if exc.status_code < 500 else logging.ERROR
        logger.log(
            log_level,
            "http.exception.handled",
            extra=_request_log_extra(
                request,
                settings,
                status_code=exc.status_code,
                detail_type=type(exc.detail).__name__,
            ),
        )
        return _json_response(request, exc.status_code, {"detail": exc.detail})

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        logger.warning(
            "http.validation.failed",
            extra=_request_log_extra(
                request,
                settings,
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                error_count=len(exc.errors()),
            ),
        )
        return _json_response(
            request,
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            {"detail": exc.errors()},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.exception(
            "http.exception.unhandled",
            extra=_request_log_extra(request, settings, status_code=status.HTTP_500_INTERNAL_SERVER_ERROR),
        )
        return _json_response(
            request,
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            {"detail": "Internal server error"},
        )


import asyncio
import logging
from typing import Any, Optional
from urllib.parse import urlsplit

import httpx

logger = logging.getLogger(__name__)

_RATE_LIMIT_RETRIES = 2
_RATE_LIMIT_WAIT = 61  # seconds — wait a full minute window


def _retry_after_seconds(value: str | None) -> float:
    if value is None or not str(value).strip():
        return float(_RATE_LIMIT_WAIT)
    try:
        parsed = float(str(value).strip())
    except (TypeError, ValueError):
        return float(_RATE_LIMIT_WAIT)
    return parsed if parsed > 0 else float(_RATE_LIMIT_WAIT)


class ApiSportsBaseClient:

    def __init__(self, base_url: str, api_key: str, timeout: float = 15.0):
        self._base_url = base_url.rstrip("/")
        self._base_url_parts = urlsplit(base_url)
        self._timeout = timeout
        self._client = httpx.AsyncClient(
            base_url=base_url,
            headers={
                "x-apisports-key": api_key,
                "Accept": "application/json",
            },
            timeout=timeout,
            limits=httpx.Limits(
                max_connections=5,
                max_keepalive_connections=5,
                keepalive_expiry=30.0,
            ),
        )
        if not (api_key or "").strip():
            logger.warning(
                "api_sports.client.api_key_missing",
                extra={
                    "base_url": self._base_url,
                    "api_host": self._base_url_parts.hostname,
                },
            )

    def _request_context(
        self,
        endpoint: str,
        params: Optional[dict],
        *,
        attempt: int,
        request: httpx.Request | None = None,
    ) -> dict[str, Any]:
        host = self._base_url_parts.hostname
        scheme = self._base_url_parts.scheme
        port = self._base_url_parts.port
        url = f"{self._base_url}{endpoint}"
        path = endpoint

        if request is not None:
            host = request.url.host or host
            scheme = request.url.scheme or scheme
            port = request.url.port or port
            url = str(request.url)
            path = request.url.path

        extra: dict[str, Any] = {
            "method": "GET",
            "endpoint": endpoint,
            "path": path,
            "url": url,
            "params": params,
            "api_host": host,
            "api_scheme": scheme,
            "attempt": attempt + 1,
            "max_attempts": _RATE_LIMIT_RETRIES + 1,
            "timeout_s": self._timeout,
        }
        if port is not None:
            extra["api_port"] = port
        return extra

    async def get(self, endpoint: str, params: Optional[dict] = None) -> dict[str, Any]:
        for attempt in range(_RATE_LIMIT_RETRIES + 1):
            try:
                resp = await self._client.get(endpoint, params=params)
                resp.raise_for_status()
                data = resp.json()
                request_context = self._request_context(endpoint, params, attempt=attempt, request=resp.request)

                if not isinstance(data, dict):
                    logger.error(
                        "api_sports.client.unexpected_format",
                        extra={
                            **request_context,
                            "response_type": type(data).__name__,
                        },
                    )
                    return {"response": [], "errors": ["unexpected_format"]}

                errors = data.get("errors")
                if isinstance(errors, dict) and errors:
                    if "rateLimit" in errors and attempt < _RATE_LIMIT_RETRIES:
                        logger.warning(
                            "api_sports.client.rate_limited",
                            extra={
                                **request_context,
                                "wait_s": _RATE_LIMIT_WAIT,
                            },
                        )
                        await asyncio.sleep(_RATE_LIMIT_WAIT)
                        continue
                    logger.error("api_sports.client.api_error", extra={**request_context, "errors": errors})
                    return {"response": [], "errors": errors}
                if isinstance(errors, list) and errors:
                    logger.error("api_sports.client.api_error", extra={**request_context, "errors": errors})
                    return {"response": [], "errors": errors}

                return data
            except httpx.HTTPStatusError as e:
                response_preview = None
                try:
                    response_preview = e.response.text[:200]
                except Exception:
                    response_preview = None
                retry_after = e.response.headers.get("Retry-After")
                request_context = self._request_context(endpoint, params, attempt=attempt, request=e.request)
                if e.response.status_code == 429 and attempt < _RATE_LIMIT_RETRIES:
                    wait_s = _retry_after_seconds(retry_after)
                    logger.warning(
                        "api_sports.client.rate_limited",
                        extra={
                            **request_context,
                            "wait_s": wait_s,
                            "retry_after": retry_after,
                            "response_preview": response_preview,
                        },
                    )
                    await asyncio.sleep(wait_s)
                    continue
                logger.error(
                    "api_sports.client.http_error",
                    extra={
                        **request_context,
                        "status_code": e.response.status_code,
                        "error_type": type(e).__name__,
                        "response_preview": response_preview,
                        "retry_after": retry_after,
                    },
                )
                return {"response": [], "errors": [f"http_{e.response.status_code}"]}
            except httpx.RequestError as e:
                cause = e.__cause__ or e.__context__
                extra = {
                    **self._request_context(endpoint, params, attempt=attempt, request=e.request),
                    "error": str(e),
                    "error_type": type(e).__name__,
                }
                if cause is not None:
                    extra["cause_type"] = type(cause).__name__
                    extra["cause"] = str(cause)
                logger.error("api_sports.client.request_error", extra=extra)
                return {"response": [], "errors": ["request_error"]}

        logger.error(
            "api_sports.client.rate_limit_retries_exhausted",
            extra=self._request_context(endpoint, params, attempt=_RATE_LIMIT_RETRIES),
        )
        return {"response": [], "errors": ["rate_limit_retries_exhausted"]}

    async def close(self):
        await self._client.aclose()

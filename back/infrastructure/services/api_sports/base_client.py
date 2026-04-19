import asyncio
import logging
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

_RATE_LIMIT_RETRIES = 2
_RATE_LIMIT_WAIT = 61  # seconds — wait a full minute window


class ApiSportsBaseClient:

    def __init__(self, base_url: str, api_key: str, timeout: float = 15.0):
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

    async def get(self, endpoint: str, params: Optional[dict] = None) -> dict[str, Any]:
        for attempt in range(_RATE_LIMIT_RETRIES + 1):
            try:
                resp = await self._client.get(endpoint, params=params)
                resp.raise_for_status()
                data = resp.json()

                if not isinstance(data, dict):
                    logger.error(
                        "api_sports.client.unexpected_format",
                        extra={
                            "endpoint": endpoint,
                            "params": params,
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
                                "endpoint": endpoint,
                                "params": params,
                                "wait_s": _RATE_LIMIT_WAIT,
                                "attempt": attempt + 1,
                                "max_attempts": _RATE_LIMIT_RETRIES + 1,
                            },
                        )
                        await asyncio.sleep(_RATE_LIMIT_WAIT)
                        continue
                    logger.error("api_sports.client.api_error", extra={"endpoint": endpoint, "params": params, "errors": errors})
                    return {"response": [], "errors": errors}
                if isinstance(errors, list) and errors:
                    logger.error("api_sports.client.api_error", extra={"endpoint": endpoint, "params": params, "errors": errors})
                    return {"response": [], "errors": errors}

                return data
            except httpx.HTTPStatusError as e:
                logger.error("api_sports.client.http_error", extra={"status_code": e.response.status_code, "endpoint": endpoint, "params": params})
                return {"response": [], "errors": [f"http_{e.response.status_code}"]}
            except httpx.RequestError as e:
                logger.error("api_sports.client.request_error", extra={"endpoint": endpoint, "params": params, "error": str(e)})
                return {"response": [], "errors": ["request_error"]}

        logger.error("api_sports.client.rate_limit_retries_exhausted", extra={"endpoint": endpoint, "params": params, "max_attempts": _RATE_LIMIT_RETRIES + 1})
        return {"response": [], "errors": ["rate_limit_retries_exhausted"]}

    async def close(self):
        await self._client.aclose()

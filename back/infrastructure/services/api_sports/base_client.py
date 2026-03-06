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
                        "Unexpected response format from %s params=%s: %s",
                        endpoint,
                        params,
                        type(data),
                    )
                    return {"response": [], "errors": ["unexpected_format"]}

                errors = data.get("errors")
                if isinstance(errors, dict) and errors:
                    if "rateLimit" in errors and attempt < _RATE_LIMIT_RETRIES:
                        logger.warning(
                            "Rate limited on %s params=%s, waiting %ss (attempt %s/%s)",
                            endpoint,
                            params,
                            _RATE_LIMIT_WAIT,
                            attempt + 1,
                            _RATE_LIMIT_RETRIES + 1,
                        )
                        await asyncio.sleep(_RATE_LIMIT_WAIT)
                        continue
                    logger.error("API-Sports error on %s params=%s: %s", endpoint, params, errors)
                    return {"response": [], "errors": errors}
                if isinstance(errors, list) and errors:
                    logger.error("API-Sports error on %s params=%s: %s", endpoint, params, errors)
                    return {"response": [], "errors": errors}

                return data
            except httpx.HTTPStatusError as e:
                logger.error(
                    "API-Sports HTTP %s on %s params=%s: %s",
                    e.response.status_code,
                    endpoint,
                    params,
                    e,
                )
                return {"response": [], "errors": [f"http_{e.response.status_code}"]}
            except httpx.RequestError as e:
                logger.error("API-Sports request error on %s params=%s: %s", endpoint, params, e)
                return {"response": [], "errors": ["request_error"]}

        return {"response": [], "errors": ["rate_limit_retries_exhausted"]}

    async def close(self):
        await self._client.aclose()

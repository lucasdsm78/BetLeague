import logging
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)


class ApiSportsBaseClient:

    def __init__(self, base_url: str, api_key: str, timeout: float = 10.0):
        self._client = httpx.AsyncClient(
            base_url=base_url,
            headers={
                "x-apisports-key": api_key,
                "Accept": "application/json",
            },
            timeout=timeout,
            limits=httpx.Limits(
                max_connections=20,
                max_keepalive_connections=10,
                keepalive_expiry=30.0,
            ),
        )

    async def get(self, endpoint: str, params: Optional[dict] = None) -> dict[str, Any]:
        try:
            resp = await self._client.get(endpoint, params=params)
            resp.raise_for_status()
            data = resp.json()

            if not isinstance(data, dict):
                logger.error(f"Unexpected response format from {endpoint}: {type(data)}")
                return {"response": []}

            errors = data.get("errors")
            if isinstance(errors, dict) and errors:
                logger.error(f"API-Sports error on {endpoint}: {errors}")
                return {"response": []}
            if isinstance(errors, list) and errors:
                logger.error(f"API-Sports error on {endpoint}: {errors}")
                return {"response": []}

            return data
        except httpx.HTTPStatusError as e:
            logger.error(f"API-Sports HTTP {e.response.status_code} on {endpoint}: {e}")
            return {"response": []}
        except httpx.RequestError as e:
            logger.error(f"API-Sports request error on {endpoint}: {e}")
            return {"response": []}

    async def close(self):
        await self._client.aclose()

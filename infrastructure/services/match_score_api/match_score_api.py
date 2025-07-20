import logging
from datetime import datetime

import httpx
import requests
from pydantic import BaseModel, ValidationError

from domain.services.match_score_api.match_score_api import MatchScoreApi
from infrastructure.config import Settings


class MatchScoreApiImpl(MatchScoreApi):
    settings: Settings

    def __init__(self, settings):
        self._client = httpx.AsyncClient(
            base_url=settings.url_api_football_data,
            headers={
                "X-Auth-Token": settings.api_football_data_token,
                "Accept": "application/json",
            },
            timeout=5.0
        )

    async def get_matches_finished(
            self,
            from_date: datetime,
            to_date: datetime
    ) -> list[dict]:

        url = "/matches"
        params = {
            "status":   "FINISHED",
            "dateFrom": from_date.date().isoformat(),
            "dateTo":   to_date.date().isoformat(),
        }

        try:
            resp = await self._client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            matches = data.get("matches", [])
            if not isinstance(matches, list):
                return []
            return [
                {
                    "id":      m["id"],
                    "utcDate": m["utcDate"],
                    "home":    m["homeTeam"]["shortName"],
                    "away":    m["awayTeam"]["shortName"],
                    "winner":  m["score"].get("winner"),
                }
                for m in matches
            ]
        except httpx.HTTPError as e:
            return []

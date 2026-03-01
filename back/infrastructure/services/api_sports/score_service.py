import logging
from datetime import datetime, date
from typing import List, Set

from domain.services.match_score_api.match_score_api import MatchScoreApi
from infrastructure.services.api_sports.base_client import ApiSportsBaseClient

logger = logging.getLogger(__name__)

_LIVE_AND_FINISHED = "1H-HT-2H-ET-BT-P-SUSP-INT-FT-AET-PEN-AWD-WO"


class ApiSportsScoreService(MatchScoreApi):

    def __init__(self, client: ApiSportsBaseClient):
        self._client = client

    async def get_matches_finished(
            self,
            from_date: datetime,
            to_date: datetime,
    ) -> list[dict]:
        data = await self._client.get(
            "/fixtures",
            params={
                "date": from_date.date().isoformat(),
                "status": "FT-AET-PEN-AWD-WO",
            }
        )

        results = []
        for fixture in data.get("response", []):
            f = fixture.get("fixture", {})
            teams = fixture.get("teams", {})
            goals = fixture.get("goals", {})

            home = teams.get("home", {})
            away = teams.get("away", {})

            gh = goals.get("home")
            ga = goals.get("away")
            winner = None
            if gh is not None and ga is not None:
                if gh > ga:
                    winner = "HOME_TEAM"
                elif ga > gh:
                    winner = "AWAY_TEAM"
                else:
                    winner = "DRAW"

            results.append({
                "id": f.get("id"),
                "utcDate": f.get("date"),
                "home": home.get("name"),
                "away": away.get("name"),
                "winner": winner,
            })

        return results

    async def get_live_scores(
            self,
            fixture_ids: List[int],
    ) -> list[dict]:
        if not fixture_ids:
            return []

        # Free plan: fetch by date + status, then filter locally by fixture_ids
        fixture_id_set: Set[int] = set(fixture_ids)
        today = date.today().isoformat()

        data = await self._client.get(
            "/fixtures",
            params={
                "date": today,
                "status": _LIVE_AND_FINISHED,
            }
        )

        results = []
        for fixture in data.get("response", []):
            f = fixture.get("fixture", {})
            goals = fixture.get("goals", {})

            fixture_id = f.get("id")
            if not fixture_id or fixture_id not in fixture_id_set:
                continue

            status_short = f.get("status", {}).get("short", "NS")
            gh = goals.get("home")
            ga = goals.get("away")

            winner = None
            if gh is not None and ga is not None:
                if status_short in ("FT", "AET", "PEN", "AWD", "WO"):
                    if gh > ga:
                        winner = "HOME_TEAM"
                    elif ga > gh:
                        winner = "AWAY_TEAM"
                    else:
                        winner = "DRAW"

            results.append({
                "api_fixture_id": fixture_id,
                "score_home": gh,
                "score_away": ga,
                "status": status_short,
                "winner": winner,
            })

        logger.info(f"Fetched live scores for {len(results)} fixtures (from {len(data.get('response', []))} total today)")
        return results

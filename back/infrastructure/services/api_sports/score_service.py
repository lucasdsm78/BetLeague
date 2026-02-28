import logging
from datetime import datetime
from typing import List

from domain.services.match_score_api.match_score_api import MatchScoreApi
from infrastructure.services.api_sports.base_client import ApiSportsBaseClient

logger = logging.getLogger(__name__)


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
                "status": "FT-AET-AP",
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

        results = []
        batch_size = 20

        for i in range(0, len(fixture_ids), batch_size):
            batch = fixture_ids[i:i + batch_size]
            ids_str = "-".join(str(fid) for fid in batch)

            data = await self._client.get(
                "/fixtures",
                params={"ids": ids_str}
            )

            for fixture in data.get("response", []):
                f = fixture.get("fixture", {})
                goals = fixture.get("goals", {})

                fixture_id = f.get("id")
                if not fixture_id:
                    continue

                status_short = f.get("status", {}).get("short", "NS")
                gh = goals.get("home")
                ga = goals.get("away")

                winner = None
                if gh is not None and ga is not None:
                    if status_short in ("FT", "AET", "AP", "AWD", "WO"):
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

        logger.info(f"Fetched live scores for {len(results)} fixtures")
        return results

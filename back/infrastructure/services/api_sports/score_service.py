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

        fixture_id_set: Set[int] = set(int(x) for x in fixture_ids if x)
        if not fixture_id_set:
            return []

        # Prefer fetching by explicit fixture IDs (more reliable than filtering by date/status).
        # API-Sports v3 expects a single integer for `id`, so we query in small batches.
        results: list[dict] = []

        logger.info(
            "[ApiSports] get_live_scores by_ids fixture_ids_count=%s",
            len(fixture_id_set),
        )

        # Low concurrency to respect rate limits and connection pool constraints.
        # We'll stop early if we already collected all requested ids.
        for fid in sorted(fixture_id_set):
            data = await self._client.get(
                "/fixtures",
                params={"id": str(fid)},
            )
            resp = data.get("response")
            if not isinstance(resp, list) or not resp:
                continue

            for fixture in resp:
                f = fixture.get("fixture", {})
                goals = fixture.get("goals", {})

                fixture_id = f.get("id")
                if not fixture_id or int(fixture_id) != fid:
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
                    "api_fixture_id": int(fixture_id),
                    "score_home": gh,
                    "score_away": ga,
                    "status": status_short,
                    "winner": winner,
                })

        # Fallback for plans that don't support `id` effectively or if we retrieved nothing.
        if not results:
            today = date.today().isoformat()
            logger.info(
                "[ApiSports] get_live_scores fallback date=%s status=%s fixture_ids_count=%s",
                today,
                _LIVE_AND_FINISHED,
                len(fixture_id_set),
            )
            data = await self._client.get(
                "/fixtures",
                params={
                    "date": today,
                    "status": _LIVE_AND_FINISHED,
                }
            )
            resp = data.get("response")
            if not isinstance(resp, list):
                resp = []

            for fixture in resp:
                f = fixture.get("fixture", {})
                goals = fixture.get("goals", {})

                fixture_id = f.get("id")
                if not fixture_id or int(fixture_id) not in fixture_id_set:
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
                    "api_fixture_id": int(fixture_id),
                    "score_home": gh,
                    "score_away": ga,
                    "status": status_short,
                    "winner": winner,
                })

        logger.info(
            "Fetched live scores for %s fixtures (requested=%s)",
            len(results),
            len(fixture_id_set),
        )
        return results

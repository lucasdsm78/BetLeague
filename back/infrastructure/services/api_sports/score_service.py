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
        # API-Sports v3 expects a single integer for `id`, so we query multiple IDs with bounded concurrency.
        results_by_id: dict[int, dict] = {}

        logger.info("api_sports.score.by_ids_started", extra={"fixture_ids_count": len(fixture_id_set)})

        import asyncio

        # Low concurrency to respect rate limits and connection pool constraints.
        # Keep in sync with Httpx client max_connections (defaults to 5).
        concurrency = 4
        sem = asyncio.Semaphore(concurrency)

        async def _fetch_one(fid: int) -> None:
            async with sem:
                data = await self._client.get(
                    "/fixtures",
                    params={"id": str(fid)},
                )
                resp = data.get("response")
                if not isinstance(resp, list) or not resp:
                    return

                for fixture in resp:
                    f = fixture.get("fixture", {})
                    goals = fixture.get("goals", {})

                    fixture_id = f.get("id")
                    if not fixture_id:
                        continue
                    try:
                        fixture_id_int = int(fixture_id)
                    except Exception:
                        continue

                    if fixture_id_int != fid:
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

                    results_by_id[fid] = {
                        "api_fixture_id": fixture_id_int,
                        "score_home": gh,
                        "score_away": ga,
                        "status": status_short,
                        "winner": winner,
                    }

        # Fire bounded-concurrency tasks
        tasks = [asyncio.create_task(_fetch_one(fid)) for fid in sorted(fixture_id_set)]
        await asyncio.gather(*tasks)

        results = list(results_by_id.values())

        # Fallback for plans that don't support `id` effectively or if we retrieved nothing.
        if not results:
            today = date.today().isoformat()
            logger.info(
                "api_sports.score.fallback_started",
                extra={
                    "date": today,
                    "status": _LIVE_AND_FINISHED,
                    "fixture_ids_count": len(fixture_id_set),
                },
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
                if not fixture_id:
                    continue
                try:
                    fixture_id_int = int(fixture_id)
                except Exception:
                    continue
                if fixture_id_int not in fixture_id_set:
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
                    "api_fixture_id": fixture_id_int,
                    "score_home": gh,
                    "score_away": ga,
                    "status": status_short,
                    "winner": winner,
                })

        logger.info("api_sports.score.loaded", extra={"results_count": len(results), "requested_count": len(fixture_id_set)})
        return results

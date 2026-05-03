import logging
from datetime import UTC, datetime
from typing import List, Set

from domain.services.match_score_api.match_score_api import MatchScoreApi
from infrastructure.services.api_sports.base_client import ApiSportsBaseClient

logger = logging.getLogger(__name__)

_LIVE_AND_FINISHED = "1H-HT-2H-ET-BT-P-SUSP-INT-FT-AET-PEN-AWD-WO"
_FINISHED_STATUSES = frozenset({"FT", "AET", "PEN", "AWD", "WO"})


def _utc_today_isoformat() -> str:
    return datetime.now(UTC).date().isoformat()


def _normalize_fixture_ids(fixture_ids: List[int] | None) -> Set[int]:
    normalized: Set[int] = set()
    if not fixture_ids:
        return normalized
    for raw_id in fixture_ids:
        try:
            fixture_id = int(raw_id)
        except (TypeError, ValueError):
            continue
        if fixture_id > 0:
            normalized.add(fixture_id)
    return normalized


def _coerce_score(value):
    if value is None:
        return None
    try:
        score = int(value)
    except (TypeError, ValueError):
        return None
    return score if score >= 0 else None


def _score_from_fixture(fixture: dict) -> dict | None:
    if not isinstance(fixture, dict):
        return None

    f = fixture.get("fixture", {})
    if not isinstance(f, dict):
        return None

    fixture_id = f.get("id")
    if not fixture_id:
        return None
    try:
        fixture_id_int = int(fixture_id)
    except (TypeError, ValueError):
        return None
    if fixture_id_int <= 0:
        return None

    status = f.get("status", {})
    status_short = status.get("short", "NS") if isinstance(status, dict) else "NS"

    goals = fixture.get("goals", {})
    if not isinstance(goals, dict):
        goals = {}
    gh = _coerce_score(goals.get("home"))
    ga = _coerce_score(goals.get("away"))

    winner = None
    if gh is not None and ga is not None and status_short in _FINISHED_STATUSES:
        if gh > ga:
            winner = "HOME_TEAM"
        elif ga > gh:
            winner = "AWAY_TEAM"
        else:
            winner = "DRAW"

    return {
        "api_fixture_id": fixture_id_int,
        "score_home": gh,
        "score_away": ga,
        "status": status_short,
        "winner": winner,
    }


class ApiSportsScoreService(MatchScoreApi):

    def __init__(
            self,
            client: ApiSportsBaseClient,
            fallback_enabled: bool = False,
            fallback_max_fixtures: int = 0,
    ):
        self._client = client
        self._fallback_enabled = bool(fallback_enabled)
        self._fallback_max_fixtures = max(0, int(fallback_max_fixtures))

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
        fixture_id_set = _normalize_fixture_ids(fixture_ids)
        if not fixture_id_set:
            return []

        # Prefer a single batch fetch by date/status to minimize request volume.
        # Fallback to per-fixture fetches only for IDs still missing from the batch response.
        results_by_id: dict[int, dict] = {}

        today = _utc_today_isoformat()
        logger.info(
            "api_sports.score.batch_started",
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
            score = _score_from_fixture(fixture)
            if score is None:
                continue

            fixture_id_int = score["api_fixture_id"]
            if fixture_id_int not in fixture_id_set:
                continue
            results_by_id[fixture_id_int] = score

        missing_ids = fixture_id_set.difference(results_by_id.keys())
        logger.info(
            "api_sports.score.batch_loaded",
            extra={
                "date": today,
                "requested_count": len(fixture_id_set),
                "loaded_count": len(results_by_id),
                "missing_count": len(missing_ids),
            },
        )

        fallback_enabled = self._fallback_enabled
        fallback_max = self._fallback_max_fixtures

        if missing_ids and fallback_enabled and fallback_max > 0:
            import asyncio

            ids_to_fetch = sorted(missing_ids)[:fallback_max]
            # Low concurrency to respect rate limits and connection pool constraints.
            # Keep in sync with Httpx client max_connections (defaults to 5).
            concurrency = min(4, len(ids_to_fetch))
            sem = asyncio.Semaphore(concurrency)

            async def _fetch_one(fid: int) -> None:
                async with sem:
                    try:
                        data = await self._client.get(
                            "/fixtures",
                            params={"id": str(fid)},
                        )
                    except Exception as exc:
                        logger.warning(
                            "api_sports.score.by_id_failed",
                            extra={"fixture_id": fid, "error_type": type(exc).__name__},
                        )
                        return

                    resp = data.get("response")
                    if not isinstance(resp, list) or not resp:
                        return

                    for fixture in resp:
                        score = _score_from_fixture(fixture)
                        if score is None:
                            continue

                        fixture_id_int = score["api_fixture_id"]
                        if fixture_id_int != fid:
                            continue
                        results_by_id[fid] = score
                        return

            logger.warning(
                "api_sports.score.by_ids_started",
                extra={
                    "fixture_ids_count": len(ids_to_fetch),
                    "missing_count": len(missing_ids),
                    "fallback_max": fallback_max,
                },
            )
            tasks = [asyncio.create_task(_fetch_one(fid)) for fid in ids_to_fetch]
            await asyncio.gather(*tasks)
        elif missing_ids:
            logger.info(
                "api_sports.score.by_ids_skipped",
                extra={
                    "missing_count": len(missing_ids),
                    "fallback_enabled": fallback_enabled,
                    "fallback_max": fallback_max,
                },
            )

        results = [results_by_id[fixture_id] for fixture_id in sorted(results_by_id)]

        logger.info("api_sports.score.loaded", extra={"results_count": len(results), "requested_count": len(fixture_id_set)})
        return results

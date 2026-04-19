import asyncio
import logging
from datetime import date, datetime, timedelta
from typing import FrozenSet, List, Optional, Tuple

import shortuuid

from domain.match.model.bet_type import BetType
from domain.match.model.match import Match
from domain.match.model.match_odd import MatchOdd
from domain.match.model.match_status import MatchStatus
from domain.match.model.sport import Sport
from domain.services.match_fetch_api.match_fetch_api import MatchFetchApi
from infrastructure.services.api_sports.base_client import ApiSportsBaseClient

logger = logging.getLogger(__name__)

# Top 5 European leagues (API-Sports IDs)
DEFAULT_LEAGUE_IDS: FrozenSet[int] = frozenset({
    39,   # Premier League (England)
    61,   # Ligue 1 (France)
    78,   # Bundesliga (Germany)
    135,  # Serie A (Italy)
    140,  # La Liga (Spain)
})

_REQUEST_DELAY = 7.0  # seconds between odds requests (< 10 req/min)

# Mapping API-Sports bet ID → BetType
_API_BET_ID_TO_TYPE = {
    1: BetType.MATCH_WINNER,
    5: BetType.GOALS_OVER_UNDER,
    8: BetType.BOTH_TEAMS_SCORE,
    10: BetType.EXACT_SCORE,
    12: BetType.DOUBLE_CHANCE,
    21: BetType.ODD_EVEN,
    38: BetType.EXACT_GOALS_NUMBER,
}

_SUPPORTED_BET_IDS = frozenset(_API_BET_ID_TO_TYPE.keys())


class ApiSportsFootballFetchService(MatchFetchApi):

    def __init__(
        self,
        client: ApiSportsBaseClient,
        league_ids: FrozenSet[int] = DEFAULT_LEAGUE_IDS,
    ):
        self._client = client
        self._league_ids = league_ids

    async def get_upcoming_matches(
            self,
            sport: Sport,
            date_from: date,
            date_to: date,
    ) -> List[Tuple[Match, List[MatchOdd]]]:
        results: List[Tuple[Match, List[MatchOdd]]] = []
        current = date_from

        while current <= date_to:
            # 1. Fetch fixtures for this day, keep only target leagues
            data = await self._client.get(
                "/fixtures",
                params={"date": current.isoformat()}
            )

            day_matches: List[Match] = []
            for fixture in data.get("response", []):
                try:
                    match = self._parse_fixture(fixture)
                    if match and match.league_id in self._league_ids:
                        day_matches.append(match)
                except Exception as e:
                    logger.warning("api_sports.football.fixture_parse_failed", extra={"error": str(e), "date": current.isoformat()})

            # 2. Fetch odds sequentially (respect 10 req/min rate limit)
            day_kept = 0
            for i, m in enumerate(day_matches):
                all_odds = await self._fetch_odds_for_fixture(m.api_fixture_id)
                if all_odds:
                    results.append((m, all_odds))
                    day_kept += 1
                if i < len(day_matches) - 1:
                    await asyncio.sleep(_REQUEST_DELAY)

            logger.info(
                "api_sports.football.day_fetched",
                extra={
                    "date": current.isoformat(),
                    "fixtures_count": len(day_matches),
                    "fixtures_with_odds_count": day_kept,
                    "kept_total_count": len(results),
                },
            )
            current = current + timedelta(days=1)

        logger.info(
            "api_sports.football.fetch_completed",
            extra={
                "date_from": date_from.isoformat(),
                "date_to": date_to.isoformat(),
                "fixtures_count": len(results),
            },
        )
        return results

    async def _fetch_odds_for_fixture(self, fixture_id: int) -> List[MatchOdd]:
        data = await self._client.get(
            "/odds",
            params={"fixture": str(fixture_id)},
        )

        all_odds: List[MatchOdd] = []

        for item in data.get("response", []):
            bookmakers = item.get("bookmakers", [])
            if not bookmakers:
                continue

            bets = bookmakers[0].get("bets", [])

            for bet in bets:
                bet_id = bet.get("id")
                if bet_id not in _SUPPORTED_BET_IDS:
                    continue

                bet_type = _API_BET_ID_TO_TYPE[bet_id]
                bet_name = bet.get("name", "")

                for v in bet.get("values", []):
                    try:
                        odd_value = float(v.get("odd", 0))
                    except (ValueError, TypeError):
                        continue
                    if odd_value <= 0:
                        continue

                    all_odds.append(MatchOdd(
                        match_id=0,  # set after match upsert
                        bet_type=bet_type,
                        bet_name=bet_name,
                        value=str(v.get("value", "")),
                        odd=odd_value,
                    ))

        logger.info("api_sports.football.fixture_odds_loaded", extra={"fixture_id": fixture_id, "odds_count": len(all_odds)})
        return all_odds

    @staticmethod
    def _parse_fixture(fixture: dict) -> Optional[Match]:
        f = fixture.get("fixture", {})
        league = fixture.get("league", {})
        teams = fixture.get("teams", {})
        goals = fixture.get("goals", {})

        fixture_id = f.get("id")
        if not fixture_id:
            return None

        home_team = teams.get("home", {})
        away_team = teams.get("away", {})

        kick_off = f.get("date")
        if not kick_off:
            return None

        kick_off = datetime.fromisoformat(kick_off.replace("Z", "+00:00")).replace(tzinfo=None)

        status_short = f.get("status", {}).get("short", "NS")
        try:
            match_status = MatchStatus(status_short)
        except ValueError:
            match_status = MatchStatus.NOT_STARTED

        return Match(
            uuid=shortuuid.uuid(),
            home_team=home_team.get("name", "Unknown"),
            away_team=away_team.get("name", "Unknown"),
            time=kick_off,
            sport=Sport.FOOTBALL,
            league_name=league.get("name"),
            league_id=league.get("id"),
            logo_home=home_team.get("logo"),
            logo_away=away_team.get("logo"),
            score_home=goals.get("home"),
            score_away=goals.get("away"),
            status=match_status,
            api_fixture_id=fixture_id,
            season=league.get("season"),
        )

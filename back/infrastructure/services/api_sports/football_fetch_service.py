import asyncio
import logging
from datetime import date, datetime, timedelta
from typing import Dict, FrozenSet, List, Optional, Tuple

import shortuuid

from domain.match.model.match import Match
from domain.match.model.match_status import MatchStatus
from domain.match.model.sport import Sport
from domain.services.match_fetch_api.match_fetch_api import MatchFetchApi
from infrastructure.services.api_sports.base_client import ApiSportsBaseClient

logger = logging.getLogger(__name__)

DEFAULT_LEAGUE_IDS: FrozenSet[int] = frozenset({
    39,   # Premier League (England)
    61,   # Ligue 1 (France)
    78,   # Bundesliga (Germany)
    135,  # Serie A (Italy)
    140,  # La Liga (Spain)
})

_REQUEST_DELAY = 7.0  # seconds between odds requests (< 10 req/min)


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
    ) -> List[Match]:
        matches: List[Match] = []
        current = date_from

        while current <= date_to:
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
                    logger.warning(f"Failed to parse fixture: {e}")

            day_kept = 0
            for i, m in enumerate(day_matches):
                odds = await self._fetch_odds_for_fixture(m.api_fixture_id)
                if odds:
                    m.cote_home, m.cote_draw, m.cote_away = odds
                    matches.append(m)
                    day_kept += 1
                # Delay between requests (skip after last one)
                if i < len(day_matches) - 1:
                    await asyncio.sleep(_REQUEST_DELAY)

            logger.info(
                f"Day {current}: {len(day_matches)} top-league fixtures, "
                f"{day_kept} with odds, "
                f"{len(matches)} kept total"
            )
            current = current + timedelta(days=1)

        logger.info(f"Fetched {len(matches)} football fixtures with odds from {date_from} to {date_to}")
        return matches

    async def _fetch_odds_for_fixture(self, fixture_id: int) -> Optional[Tuple[float, float, float]]:
        data = await self._client.get(
            "/odds",
            params={"fixture": str(fixture_id), "bet": "1"},
        )

        for item in data.get("response", []):
            bookmakers = item.get("bookmakers", [])
            if not bookmakers:
                continue

            # Take first bookmaker that has Match Winner odds
            bets = bookmakers[0].get("bets", [])
            if not bets:
                continue

            values = bets[0].get("values", [])
            home = draw = away = 0.0
            for v in values:
                try:
                    odd = float(v.get("odd", 0))
                except (ValueError, TypeError):
                    continue
                if v.get("value") == "Home":
                    home = odd
                elif v.get("value") == "Draw":
                    draw = odd
                elif v.get("value") == "Away":
                    away = odd

            if home > 0 and draw > 0 and away > 0:
                return home, draw, away

        return None

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
            cote_home=0.0,
            cote_draw=0.0,
            cote_away=0.0,
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

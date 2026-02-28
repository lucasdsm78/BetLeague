import logging
from datetime import date, datetime, timedelta
from typing import List, Optional

import shortuuid

from domain.match.model.match import Match
from domain.match.model.match_status import MatchStatus
from domain.match.model.sport import Sport
from domain.services.match_fetch_api.match_fetch_api import MatchFetchApi
from infrastructure.services.api_sports.base_client import ApiSportsBaseClient

logger = logging.getLogger(__name__)


class ApiSportsFootballFetchService(MatchFetchApi):

    def __init__(self, client: ApiSportsBaseClient):
        self._client = client

    async def get_upcoming_matches(
            self,
            sport: Sport,
            date_from: date,
            date_to: date,
    ) -> List[Match]:
        matches = []
        current = date_from

        while current <= date_to:
            data = await self._client.get(
                "/fixtures",
                params={"date": current.isoformat()}
            )
            for fixture in data.get("response", []):
                try:
                    match = self._parse_fixture(fixture)
                    if match:
                        matches.append(match)
                except Exception as e:
                    logger.warning(f"Failed to parse fixture: {e}")

            current = current + timedelta(days=1)

        logger.info(f"Fetched {len(matches)} football fixtures from {date_from} to {date_to}")
        return matches

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

        kick_off = datetime.fromisoformat(kick_off.replace("Z", "+00:00"))

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

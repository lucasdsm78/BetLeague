from datetime import date
from typing import Dict, List

from domain.match.model.match import Match
from domain.match.model.sport import Sport
from domain.services.match_fetch_api.match_fetch_api import MatchFetchApi


class MultiSportMatchFetchRouter(MatchFetchApi):

    def __init__(self, services: Dict[Sport, MatchFetchApi]):
        self._services = services

    async def get_upcoming_matches(
            self,
            sport: Sport,
            date_from: date,
            date_to: date,
    ) -> List[Match]:
        service = self._services.get(sport)
        if not service:
            raise ValueError(f"No fetch service registered for sport: {sport.value}")
        return await service.get_upcoming_matches(sport, date_from, date_to)

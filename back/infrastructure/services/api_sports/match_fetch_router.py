from datetime import date
import logging
from typing import Dict, List, Tuple

from domain.match.model.match import Match
from domain.match.model.match_odd import MatchOdd
from domain.match.model.sport import Sport
from domain.services.match_fetch_api.match_fetch_api import MatchFetchApi


logger = logging.getLogger(__name__)


class MultiSportMatchFetchRouter(MatchFetchApi):

    def __init__(self, services: Dict[Sport, MatchFetchApi]):
        self._services = services

    async def get_upcoming_matches(
            self,
            sport: Sport,
            date_from: date,
            date_to: date,
    ) -> List[Tuple[Match, List[MatchOdd]]]:
        service = self._services.get(sport)
        if not service:
            logger.warning("match.fetch_router.rejected", extra={"sport": sport.value, "reason": "service_missing"})
            raise ValueError(f"No fetch service registered for sport: {sport.value}")
        results = await service.get_upcoming_matches(sport, date_from, date_to)
        logger.info("match.fetch_router.routed", extra={"sport": sport.value, "matches_count": len(results), "date_from": str(date_from), "date_to": str(date_to)})
        return results

from abc import ABC, abstractmethod
from datetime import date
from typing import List, Tuple

from domain.match.model.match import Match
from domain.match.model.match_odd import MatchOdd
from domain.match.model.sport import Sport


class MatchFetchApi(ABC):

    @abstractmethod
    async def get_upcoming_matches(
            self,
            sport: Sport,
            date_from: date,
            date_to: date,
    ) -> List[Tuple[Match, List[MatchOdd]]]:
        raise NotImplementedError

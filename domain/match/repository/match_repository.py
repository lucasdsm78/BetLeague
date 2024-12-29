from abc import ABC, abstractmethod
from typing import List, Optional

from domain.match.model.match import Match


class MatchRepository(ABC):

    @abstractmethod
    def find_match(self, home_team: str, away_team: str, cote_home: float, cote_draw: float, cote_away: float) -> bool:
        raise NotImplementedError

    @abstractmethod
    def find_matches(self) -> List[Match]:
        raise NotImplementedError

    @abstractmethod
    def commit(self):
        raise NotImplementedError

    @abstractmethod
    def rollback(self):
        raise NotImplementedError

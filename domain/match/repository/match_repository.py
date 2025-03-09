from datetime import datetime
from abc import ABC, abstractmethod
from typing import List, Optional, Set

from application.ticket.ticket_command_model import MatchChoiceData
from domain.match.model.match import Match
from domain.ticket.model.match_choice import MatchChoice


class MatchRepository(ABC):

    @abstractmethod
    def find_match(self, home_team: str, away_team: str, cote_home: float, cote_draw: float, cote_away: float) -> bool:
        raise NotImplementedError

    @abstractmethod
    def find_by_id(self, match_id: int) -> Optional[Match]:
        raise NotImplementedError

    @abstractmethod
    def find_matches(self) -> List[Match]:
        raise NotImplementedError

    @abstractmethod
    def exists_match_started_for_ticket(self, match_choices: List[MatchChoiceData]) -> bool:
        raise NotImplementedError

    @abstractmethod
    def commit(self):
        raise NotImplementedError

    @abstractmethod
    def rollback(self):
        raise NotImplementedError

from abc import ABC, abstractmethod
from typing import List, Optional
from datetime import datetime
from application.ticket.ticket_command_model import MatchChoiceData
from domain.match.model.match import Match


class MatchRepository(ABC):

    @abstractmethod
    async def find_match(self, home_team: str, away_team: str, cote_home: float, cote_draw: float, cote_away: float) -> bool:
        raise NotImplementedError

    @abstractmethod
    async def find_by_id(self, match_id: int) -> Optional[Match]:
        raise NotImplementedError

    @abstractmethod
    async def find_all_by_ids(self, match_ids: List[int]) -> List[Match]:
        raise NotImplementedError

    @abstractmethod
    async def find_matches(self) -> List[Match]:
        raise NotImplementedError

    @abstractmethod
    async def count_upcoming_matches(self) -> int:
        raise NotImplementedError

    @abstractmethod
    async def find_matches_paginated(self, page: int, page_size: int) -> List[Match]:
        raise NotImplementedError

    @abstractmethod
    async def exists_match_started_for_ticket(self, match_choices: List[MatchChoiceData]) -> bool:
        raise NotImplementedError

    @abstractmethod
    async def bulk_update_winner(self, updates: list[dict]):
        raise NotImplementedError

    @abstractmethod
    async def get_matches_from_dates(self, to_date: datetime, from_date: datetime) -> List[Match]:
        raise NotImplementedError

    @abstractmethod
    async def begin(self):
        raise NotImplementedError

    @abstractmethod
    async def commit(self):
        raise NotImplementedError

    @abstractmethod
    async def rollback(self):
        raise NotImplementedError

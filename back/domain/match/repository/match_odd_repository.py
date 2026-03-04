from abc import ABC, abstractmethod
from typing import List, Optional

from domain.match.model.match_odd import MatchOdd


class MatchOddRepository(ABC):

    @abstractmethod
    async def save_many(self, odds: List[MatchOdd]) -> None:
        raise NotImplementedError

    @abstractmethod
    async def find_by_match_id(self, match_id: int) -> List[MatchOdd]:
        raise NotImplementedError

    @abstractmethod
    async def find_by_id(self, odd_id: int) -> Optional[MatchOdd]:
        raise NotImplementedError

    @abstractmethod
    async def find_pending_by_match_ids(self, match_ids: List[int]) -> List[MatchOdd]:
        raise NotImplementedError

    @abstractmethod
    async def bulk_update_results(self, updates: List[dict]) -> None:
        raise NotImplementedError

    @abstractmethod
    async def upsert_many_for_match(self, match_id: int, odds: List[MatchOdd]) -> None:
        """Upsert odds for a match: update existing by (match_id, bet_type, value),
        insert new ones, and only delete stale odds that have no pending match_choices."""
        raise NotImplementedError

    @abstractmethod
    async def delete_by_match_id(self, match_id: int) -> None:
        raise NotImplementedError

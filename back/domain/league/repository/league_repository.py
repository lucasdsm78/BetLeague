from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional, List

from domain.league.model.league import League


class LeagueRepository(ABC):

    @abstractmethod
    async def create(self, league: League) -> Optional[League]:
        raise NotImplementedError

    @abstractmethod
    async def find_by_id(self, league_id: int) -> Optional[League]:
        raise NotImplementedError

    @abstractmethod
    async def find_by_name(self, name: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    async def find_leagues(self, user_id: int, page: int = 1, limit: int = 10) -> List[League]:
        raise NotImplementedError

    @abstractmethod
    async def count_leagues(self, user_id: int) -> int:
        raise NotImplementedError

    @abstractmethod
    async def find_created_leagues(self, user_id: int, page: int = 1, limit: int = 10) -> List[League]:
        raise NotImplementedError

    @abstractmethod
    async def count_created_leagues(self, user_id: int) -> int:
        raise NotImplementedError

    @abstractmethod
    async def find_participated_leagues(self, user_id: int, page: int = 1, limit: int = 10) -> List[League]:
        raise NotImplementedError

    @abstractmethod
    async def count_participated_leagues(self, user_id: int) -> int:
        raise NotImplementedError

    @abstractmethod
    async def find_by_uuid(self, league_uuid: str) -> Optional[League]:
        raise NotImplementedError

    @abstractmethod
    async def update(self, league: League) -> Optional[League]:
        raise NotImplementedError

    @abstractmethod
    async def find_due_payout_ids(self, as_of: datetime) -> List[int]:
        raise NotImplementedError

    @abstractmethod
    async def find_by_id_for_update(self, league_id: int) -> Optional[League]:
        raise NotImplementedError

    @abstractmethod
    async def find_all_by_ids(self, league_ids: List[int]) -> List[League]:
        raise NotImplementedError

    @abstractmethod
    async def count_players(self, league_id: int) -> int:
        raise NotImplementedError

    @abstractmethod
    async def get_top_scorer(self, league_id: int) -> tuple[int, int]:
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

    @abstractmethod
    async def find_my_leagues(self, user_id: int, page: int = 1, limit: int = 10) -> List[League]:
        raise NotImplementedError

    @abstractmethod
    async def count_my_leagues(self, user_id: int) -> int:
        raise NotImplementedError

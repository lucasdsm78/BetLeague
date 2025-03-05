from abc import ABC, abstractmethod
from typing import Optional, List

from domain.league.model.league import League


class LeagueRepository(ABC):

    @abstractmethod
    def create(self, league: League) -> Optional[League]:
        raise NotImplementedError

    @abstractmethod
    def find_by_id(self, league_id: int) -> Optional[League]:
        raise NotImplementedError

    @abstractmethod
    def find_by_name(self, name: str) -> Optional[League]:
        raise NotImplementedError

    @abstractmethod
    def find_leagues(self,  user_id: int, page: int = 1, limit: int = 10) -> List[League]:
        raise NotImplementedError

    @abstractmethod
    def find_by_uuid(self, league_uuid: str) -> Optional[League]:
        raise NotImplementedError

    @abstractmethod
    def update(self, league: League) -> Optional[League]:
        raise NotImplementedError

    @abstractmethod
    def commit(self):
        raise NotImplementedError

    @abstractmethod
    def rollback(self):
        raise NotImplementedError

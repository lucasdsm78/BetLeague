from abc import ABC, abstractmethod
from typing import Optional, List

from domain.tournament.model.tournament import Tournament

class TournamentRepository(ABC):
    @abstractmethod
    async def create(self, tournament: Tournament) -> Optional[Tournament]:
        raise NotImplementedError

    @abstractmethod
    async def find_by_id(self, tournament_id: int) -> Optional[Tournament]:
        raise NotImplementedError

    @abstractmethod
    async def find_all_by_user_creator(self, user_id: int) -> List[Tournament]:
        raise NotImplementedError
    #
    # @abstractmethod
    # async def find_all_by_player(self, user_id: int) -> List[Tournament]:
    #     raise NotImplementedError

    async def find_all_by_user_participant(self, user_id: int, limit: int, offset: int) -> List[Tournament]:
        raise NotImplementedError

    async def count_tournaments_by_user_id(self, user_id: int) -> int:
        raise NotImplementedError

    @abstractmethod
    async def find_by_uuid(self, uuid: str) -> Optional[Tournament]:
        raise NotImplementedError

    @abstractmethod
    async def update(self, tournament: Tournament) -> Optional[Tournament]:
        raise NotImplementedError

    @abstractmethod
    async def count_players(self, tournament_id: int) -> int:
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

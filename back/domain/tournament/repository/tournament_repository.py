from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional, List, Tuple

from domain.tournament.model.tournament import Tournament

class TournamentRepository(ABC):

    @abstractmethod
    async def create(self, tournament: Tournament) -> Optional[Tournament]:
        raise NotImplementedError

    @abstractmethod
    async def find_by_id(self, tournament_id: int) -> Tournament:
        raise NotImplementedError

    @abstractmethod
    async def find_by_name(self, tournament_name: str) -> Optional[Tournament]:
        raise NotImplementedError

    @abstractmethod
    async def find_all_by_user_creator(self, user_id: int) -> List[Tournament]:
        raise NotImplementedError

    @abstractmethod
    async def find_all_by_user_participant(self, user_id: int, limit: int, offset: int)-> Tuple[List[Tournament], int]:
        raise NotImplementedError

    @abstractmethod
    async def find_all_by_status(self, status: str)-> List[Tournament]:
        raise NotImplementedError

    @abstractmethod
    async def find_in_progress_for_user(self, user_id: int) -> List[Tournament]:
        raise NotImplementedError

    @abstractmethod
    async def find_available_tournaments_public(
            self,
            user_id: int,
            limit: int,
            offset: int
    ) -> Tuple[List[Tournament], int]:
        raise NotImplementedError

    @abstractmethod
    async def find_finished_tournaments(
            self,
            user_id: int,
            limit: int,
            offset: int
    ) -> Tuple[List[Tournament], int]:
        raise NotImplementedError

    @abstractmethod
    async def find_created_tournaments(
            self,
            user_id: int,
            limit: int,
            offset: int
    ) -> Tuple[List[Tournament], int]:
        raise NotImplementedError

    @abstractmethod
    async def find_by_uuid(self, uuid: str) -> Tournament:
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

    @abstractmethod
    async def count_created_by_user_between(self, user_id: int, created_from_ms: int, created_to_ms: int) -> int:
        raise NotImplementedError

    @abstractmethod
    async def find_due_tournament_ids(self, as_of: datetime) -> List[int]:
        raise NotImplementedError

    @abstractmethod
    async def find_by_id_for_update(self, tournament_id: int) -> Optional[Tournament]:
        raise NotImplementedError


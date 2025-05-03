from abc import ABC, abstractmethod
from typing import Optional, List

from domain.ticket.model.match_choice import MatchChoice


class MatchChoiceRepository(ABC):

    @abstractmethod
    async def create(self, match_choice: MatchChoice) -> Optional[MatchChoice]:
        raise NotImplementedError

    @abstractmethod
    async def find_all_by_ticket_id(self, ticket_id: int) -> List[MatchChoice]:
        raise NotImplementedError

    @abstractmethod
    async def delete_by_ticket_id(self, ticket_id: int):
        raise NotImplementedError

    @abstractmethod
    async def update(self, match_choice: MatchChoice) -> Optional[MatchChoice]:
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

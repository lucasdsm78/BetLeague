from abc import ABC, abstractmethod
from typing import Optional, List

from domain.ticket.model.match_choice import MatchChoice
from domain.ticket.model.match_choice_status import MatchChoiceStatus


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
    async def get_match_choices_pending_by_match_id(self, match_id: int) -> List[MatchChoice]:
        raise NotImplementedError

    @abstractmethod
    async def mark_choice_status(self, choice_id: int, status: MatchChoiceStatus):
        raise NotImplementedError

    @abstractmethod
    async def bulk_mark_choice_status(self, updates: List[tuple[int, MatchChoiceStatus]]) -> None:
        raise NotImplementedError

    @abstractmethod
    async def find_all_by_ticket_ids(self, ticket_ids: List[int]) -> List[MatchChoice]:
        raise NotImplementedError

    @abstractmethod
    async def update(self, match_choice: MatchChoice) -> Optional[MatchChoice]:
        raise NotImplementedError

    @abstractmethod
    async def count_wrong_and_pending_by_ticket(
            self,
            ticket_id: int
    ) -> tuple[int, int]:
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

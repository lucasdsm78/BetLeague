from abc import ABC, abstractmethod
from typing import Optional, List

from domain.ticket.model.match_choice import MatchChoice
from domain.ticket.model.ticket import Ticket


class TicketRepository(ABC):

    @abstractmethod
    async def create(self, ticket: Ticket) -> Optional[Ticket]:
        raise NotImplementedError

    @abstractmethod
    async def find_by_id(self, ticket_id: int) -> Optional[Ticket]:
        raise NotImplementedError

    @abstractmethod
    async def find_all_in_progress_by_user_id(self, user_id: int) -> List[Ticket]:
        raise NotImplementedError

    @abstractmethod
    async def find_all_finished_by_user_id(self, user_id: int) -> List[Ticket]:
        raise NotImplementedError

    @abstractmethod
    async def get_gain(self, match_choices: List[MatchChoice], mise: int) -> float:
        raise NotImplementedError

    @abstractmethod
    async def find_by_uuid(self, ticket_uuid: str) -> Optional[Ticket]:
        raise NotImplementedError

    @abstractmethod
    async def find_by_player_match(self, user_id: int, match_id: int) -> Optional[Ticket]:
        raise NotImplementedError

    @abstractmethod
    async def find_by_id_for_update(self, ticket_id: int) -> Optional[Ticket]:
        raise NotImplementedError

    @abstractmethod
    async def apply_ticket_updates(
            self,
            ticket_id: int,
            user_id: int,
            league_id: int,
            wrong_count: int,
            pending_count: int,
            gain: float
    ) -> bool:
        raise NotImplementedError

    @abstractmethod
    async def update(self, ticket: Ticket) -> Optional[Ticket]:
        raise NotImplementedError

    @abstractmethod
    async def delete(self, ticket_id: int):
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

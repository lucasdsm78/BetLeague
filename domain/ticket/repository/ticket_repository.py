from abc import ABC, abstractmethod
from typing import Optional, List

from domain.ticket.model.match_choice import MatchChoice
from domain.ticket.model.ticket import Ticket


class TicketRepository(ABC):

    @abstractmethod
    def create(self, ticket: Ticket) -> Optional[Ticket]:
        raise NotImplementedError

    @abstractmethod
    def find_by_id(self, ticket_id: int) -> Optional[Ticket]:
        raise NotImplementedError

    @abstractmethod
    def get_gain(self, match_choices: List[MatchChoice], mise: int) -> float:
        raise NotImplementedError

    @abstractmethod
    def find_by_uuid(self, ticket_uuid: str) -> Optional[Ticket]:
        raise NotImplementedError

    @abstractmethod
    def update(self, ticket: Ticket) -> Optional[Ticket]:
        raise NotImplementedError

    @abstractmethod
    def commit(self):
        raise NotImplementedError

    @abstractmethod
    def rollback(self):
        raise NotImplementedError

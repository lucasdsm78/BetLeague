from abc import ABC, abstractmethod
from typing import Optional

from domain.ticket.model.ticket import Ticket


class TicketRepository(ABC):

    @abstractmethod
    def create(self, ticket: Ticket) -> Optional[Ticket]:
        raise NotImplementedError

    @abstractmethod
    def find_by_id(self, ticket_id: int) -> Optional[Ticket]:
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

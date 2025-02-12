from abc import ABC, abstractmethod
from typing import Optional, List

from domain.ticket.model.match_choice import MatchChoice


class MatchChoiceRepository(ABC):

    @abstractmethod
    def create(self, match_choice: MatchChoice) -> Optional[MatchChoice]:
        raise NotImplementedError

    @abstractmethod
    def get_all_match_choices_pending(self) -> List[MatchChoice]:
        raise NotImplementedError

    def delete_by_ticket_id(self, ticket_id: int):
        raise NotImplementedError

    @abstractmethod
    def update(self, match_choice: MatchChoice) -> Optional[MatchChoice]:
        raise NotImplementedError

    @abstractmethod
    def commit(self):
        raise NotImplementedError

    @abstractmethod
    def rollback(self):
        raise NotImplementedError

from abc import ABC, abstractmethod

from domain.tournament.model import TournamentMatch


class TournamentMatchRepository(ABC):

    @abstractmethod
    async def add_match(self, match: TournamentMatch) -> TournamentMatch:
        raise NotImplementedError

    @abstractmethod
    async def update_match(self, match: TournamentMatch) -> TournamentMatch:
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

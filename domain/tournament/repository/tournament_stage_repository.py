from abc import ABC, abstractmethod

from domain.tournament.model import TournamentStage


class TournamentStageRepository(ABC):
    @abstractmethod
    async def add_stage(self, stage: TournamentStage) -> TournamentStage:
        raise NotImplementedError

    @abstractmethod
    async def update_stage(self, stage: TournamentStage):
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

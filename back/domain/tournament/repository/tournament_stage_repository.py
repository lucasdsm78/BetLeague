from abc import ABC, abstractmethod
from datetime import datetime

from domain.tournament.model import TournamentStage
from typing import List, Optional


class TournamentStageRepository(ABC):
    @abstractmethod
    async def add_stage(self, stage: TournamentStage) -> TournamentStage:
        raise NotImplementedError

    @abstractmethod
    async def find_by_id(self, tournament_id: int, stage: str) -> Optional[TournamentStage]:
        raise NotImplementedError

    @abstractmethod
    async def get_active_stage(self, tournament_id: int) -> Optional[TournamentStage]:
        raise NotImplementedError

    @abstractmethod
    async def update_stage(self, stage: TournamentStage):
        raise NotImplementedError

    @abstractmethod
    async def find_all_by_tournament(self, tournament_id: int) -> List[TournamentStage]:
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
    async def find_due_active_stage_for_update(self, tournament_id: int, as_of: datetime) -> Optional[TournamentStage]:
        raise NotImplementedError

    @abstractmethod
    async def find_next_stage(self, tournament_id: int, current_stage: TournamentStage) -> Optional[TournamentStage]:
        raise NotImplementedError


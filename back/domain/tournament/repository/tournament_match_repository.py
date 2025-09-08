from abc import ABC, abstractmethod
from typing import List, Optional
from domain.tournament.model.tournament_match import TournamentMatch
from domain.tournament.model.stage_type import StageType


class TournamentMatchRepository(ABC):

    @abstractmethod
    async def add_match(self, match: TournamentMatch) -> TournamentMatch:
        raise NotImplementedError

    @abstractmethod
    async def find_matches_by_tournament_stages(self, tournament_id: int, stage: str):
        raise NotImplementedError

    @abstractmethod
    async def find_matches_by_tournament_id(self, tournament_id: int):
        raise NotImplementedError

    @abstractmethod
    async def update(self, match: TournamentMatch) -> Optional[TournamentMatch]:
        raise NotImplementedError

    @abstractmethod
    async def find_by_id(self, match_id: int) -> Optional[TournamentMatch]:
        raise NotImplementedError

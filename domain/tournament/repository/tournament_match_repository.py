from abc import ABC, abstractmethod
from typing import List, Optional
from domain.tournament.model.tournament_match import TournamentMatch
from domain.tournament.model.stage_type import StageType


class TournamentMatchRepository(ABC):

    @abstractmethod
    async def add_match(self, match: TournamentMatch) -> TournamentMatch:
        pass

from abc import ABC, abstractmethod
from typing import List, Optional

from domain.tournament.model.tournament import TournamentStage
from domain.tournament.model.tournament_player import TournamentPlayer

class TournamentPlayersRepository(ABC):
    @abstractmethod
    async def add_player(self, player: TournamentPlayer) -> Optional[TournamentPlayer]:
        raise NotImplementedError

    @abstractmethod
    async def get_player(self, tournament_id: int, user_id: int) -> Optional[TournamentPlayer]:
        raise NotImplementedError

    @abstractmethod
    async def update(self, player: TournamentPlayer) -> Optional[TournamentPlayer]:
        raise NotImplementedError

    @abstractmethod
    async def count_players(self, tournament_id: int) -> int:
        raise NotImplementedError

    @abstractmethod
    async def get_players_by_stage(self, tournament_id: int, stage: TournamentStage) -> List[TournamentPlayer]:
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

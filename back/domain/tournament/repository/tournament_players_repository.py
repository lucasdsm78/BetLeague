from abc import ABC, abstractmethod
from typing import List, Optional

from domain.tournament.model.tournament_player import TournamentPlayer
from domain.tournament.model.tournament_stage import TournamentStage


class TournamentPlayersRepository(ABC):

    @abstractmethod
    async def add_player(self, player: TournamentPlayer) -> Optional[TournamentPlayer]:
        raise NotImplementedError

    @abstractmethod
    async def get_player(self, tournament_id: int, user_id: int) -> Optional[TournamentPlayer]:
        raise NotImplementedError

    @abstractmethod
    async def unregister_tournament(self, tournament_players_id: int):
        raise NotImplementedError

    @abstractmethod
    async def update(self, player: TournamentPlayer) -> Optional[TournamentPlayer]:
        raise NotImplementedError

    @abstractmethod
    async def get_non_eliminated_players(self, tournament_id: int) -> List[TournamentPlayer]:
        raise NotImplementedError

    @abstractmethod
    async def count_players(self, tournament_id: int) -> int:
        raise NotImplementedError

    @abstractmethod
    async def find_players_by_stage(self, tournament_id: int, stage: TournamentStage) -> List[TournamentPlayer]:
        raise NotImplementedError

    @abstractmethod
    async def find_players_by_tournament_id(self, tournament_id: int) -> List[TournamentPlayer]:
        raise NotImplementedError

    @abstractmethod
    async def find_players_with_paid_option(self, tournament_id: int) -> List[TournamentPlayer]:
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

from abc import ABC, abstractmethod
from typing import Optional

from domain.tournament_bet.model.tournament_bet import TournamentBet


class TournamentBetRepository(ABC):
    @abstractmethod
    async def add(self, bet: TournamentBet) -> Optional[TournamentBet]:
        raise NotImplementedError

    @abstractmethod
    async def find_by_player_match(self, player_id: int, match_id: int) -> Optional[TournamentBet]:
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

from abc import ABC, abstractmethod
from typing import Optional, List, Dict

from domain.league.model.league_players import LeaguePlayers


class LeaguePlayersRepository(ABC):

    @abstractmethod
    async def join_league(self, league_players: LeaguePlayers) -> Optional[LeaguePlayers]:
        raise NotImplementedError

    @abstractmethod
    async def get_league_rank(self, league_id: int) -> List[Dict[str, any]]:
        raise NotImplementedError

    @abstractmethod
    async def unregister_league(self, league_players_id: int):
        raise NotImplementedError

    @abstractmethod
    async def find_participation(self, league_id: int, user_id: int) -> bool:
        raise NotImplementedError

    @abstractmethod
    async def get_participation(self, league_id: int, user_id: int) -> Optional[LeaguePlayers]:
        raise NotImplementedError

    @abstractmethod
    async def get_balances_by_league_ids(self, user_id: int, league_ids: List[int]) -> Dict[int, float]:
        raise NotImplementedError

    @abstractmethod
    async def count_players(self, league_id: int) -> int:
        raise NotImplementedError

    @abstractmethod
    async def delete_player(self, league_player_id: int):
        raise NotImplementedError

    @abstractmethod
    async def update(self, league_player: LeaguePlayers) -> Optional[LeaguePlayers]:
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

from abc import ABC, abstractmethod
from typing import Optional, List, Dict

from domain.league.model.league_players import LeaguePlayers


class LeaguePlayersRepository(ABC):

    @abstractmethod
    def join_league(self, league_players: LeaguePlayers) -> Optional[LeaguePlayers]:
        raise NotImplementedError

    @abstractmethod
    def get_league_rank(self, league_id: int) -> List[Dict[str, any]]:
        raise NotImplementedError

    @abstractmethod
    def unregister_league(self, league_players_id: int):
        raise NotImplementedError

    @abstractmethod
    def find_participation(self, league_id: int, user_id: int) -> bool:
        raise NotImplementedError

    @abstractmethod
    def get_participation(self, league_id: int, user_id: int) -> Optional[LeaguePlayers]:
        raise NotImplementedError

    @abstractmethod
    def count_players(self, league_id: int) -> int:
        raise NotImplementedError

    @abstractmethod
    def commit(self):
        raise NotImplementedError

    @abstractmethod
    def rollback(self):
        raise NotImplementedError

from abc import ABC, abstractmethod
from typing import List, Dict

from pydantic import BaseModel

from domain.league.repository.league_players_repository import LeaguePlayersRepository


class LeagueQueryUseCase(ABC):

    @abstractmethod
    def get_rank_by_league_id(self, league_id: int) -> List[Dict[str, any]]:
        raise NotImplementedError


class LeagueQueryUseCaseImpl(LeagueQueryUseCase, BaseModel):
    league_players_repository: LeaguePlayersRepository

    class Config:
        arbitrary_types_allowed = True

    def get_rank_by_league_id(self, league_id: int) -> List[Dict[str, any]]:
        try:
            return self.league_players_repository.get_league_rank(league_id=league_id)

        except Exception as e:
            raise

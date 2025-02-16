from abc import ABC, abstractmethod
from typing import List, Dict

from pydantic import BaseModel

from domain.league.exception.league_exception import LeagueParticipantNotFoundError
from domain.league.repository.league_players_repository import LeaguePlayersRepository
from domain.user.repository.user_repository import UserRepository


class LeagueQueryUseCase(ABC):

    @abstractmethod
    def get_rank_by_league_id(self, email: str, league_id: int) -> List[Dict[str, any]]:
        raise NotImplementedError


class LeagueQueryUseCaseImpl(LeagueQueryUseCase, BaseModel):
    league_players_repository: LeaguePlayersRepository
    user_repository: UserRepository

    class Config:
        arbitrary_types_allowed = True

    def get_rank_by_league_id(self, email: str, league_id: int) -> List[Dict[str, any]]:
        try:
            user = self.user_repository.find_by_email(email)
            is_participate = self.league_players_repository.find_participation(
                    league_id=league_id,
                    user_id=user.id
                )

            if is_participate is False:
                raise LeagueParticipantNotFoundError

            return self.league_players_repository.get_league_rank(league_id=league_id)

        except Exception as e:
            raise

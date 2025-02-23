from abc import ABC, abstractmethod
from typing import List, Dict, Optional

from pydantic import BaseModel

from application.league.league_query_model import LeagueReadModel
from domain.league.exception.league_exception import LeagueParticipantNotFoundError, LeagueNotFoundError
from domain.league.repository.league_players_repository import LeaguePlayersRepository
from domain.league.repository.league_repository import LeagueRepository
from domain.user.repository.user_repository import UserRepository


class LeagueQueryUseCase(ABC):

    @abstractmethod
    def get_rank_by_league_id(self, email: str, league_id: int) -> List[Dict[str, any]]:
        raise NotImplementedError

    @abstractmethod
    def get_league_by_id(self, league_id: int, email: str) -> Optional[LeagueReadModel]:
        raise NotImplementedError


class LeagueQueryUseCaseImpl(LeagueQueryUseCase, BaseModel):
    league_players_repository: LeaguePlayersRepository
    user_repository: UserRepository
    league_repository: LeagueRepository

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

    def get_league_by_id(self, league_id: int, email: str) -> Optional[LeagueReadModel]:
        try:
            user = self.user_repository.find_by_email(email)
            league = self.league_repository.find_by_id(league_id)
            if not league:
                raise LeagueNotFoundError

            if league.is_private:
                if not self.league_players_repository.find_participation(
                        league_id=league_id,
                        user_id=user.id
                ):
                    raise LeagueParticipantNotFoundError

        except Exception as e:
            raise

        return LeagueReadModel.from_entity_get_by_id(league)


from abc import ABC, abstractmethod
from typing import Optional

from pydantic import BaseModel

from application.tournament.tournament_query_model import TournamentReadModel
from domain.tournament.repository.tournament_repository import TournamentRepository
from domain.user.exception.user_exception import UserNotFoundError
from domain.user.repository.user_repository import UserRepository
from infrastructure.postgresql.tournament.tournament_repository import TournamentRepositoryImpl
from infrastructure.postgresql.user.user_repository import UserRepositoryImpl

class TournamentQueryUseCase(ABC):
    @abstractmethod
    async def get_tournament(self, tournament_id: int, email: str) -> Optional[TournamentReadModel]:
        raise NotImplementedError


class TournamentQueryUseCaseImpl(TournamentQueryUseCase, BaseModel):
    tournament_repository: TournamentRepository
    user_repository: UserRepository

    class Config:
        arbitrary_types_allowed = True

    async def get_tournament(self, tournament_id: int, email: str) -> Optional[TournamentReadModel]:
        user = await self.user_repository.find_by_email(email)
        if not user:
            raise UserNotFoundError
        tournament = await self.tournament_repository.find_by_id(tournament_id)
        if not tournament:
            return None
        return TournamentReadModel.from_entity(tournament)

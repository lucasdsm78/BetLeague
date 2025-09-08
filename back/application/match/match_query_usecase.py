from abc import ABC, abstractmethod
from pydantic import BaseModel

from application.match.match_query_model import MatchReadModel
from domain.match.repository.match_repository import MatchRepository
from domain.user.exception.user_exception import UserNotFoundError
from domain.user.repository.user_repository import UserRepository


class MatchQueryUseCase(ABC):

    @abstractmethod
    async def get_matches(self, email: str) -> dict:
        raise NotImplementedError


class MatchQueryUseCaseImpl(MatchQueryUseCase, BaseModel):
    match_repository: MatchRepository
    user_repository: UserRepository

    class Config:
        arbitrary_types_allowed = True

    async def get_matches(self, email: str) -> dict:
        user = await self.user_repository.find_by_email(email)
        if not user:
            raise UserNotFoundError

        matches = await self.match_repository.find_matches()

        return {
            "matches": [
                MatchReadModel.from_entity(match=match)
                for match in matches
            ]
    }

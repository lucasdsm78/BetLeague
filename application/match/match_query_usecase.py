from abc import ABC, abstractmethod
from pydantic import BaseModel

from application.match.match_query_model import MatchReadModel
from domain.match.repository.match_repository import MatchRepository
from domain.user.exception.user_exception import UserNotFoundError
from domain.user.repository.user_repository import UserRepository


class MatchQueryUseCase(ABC):

    @abstractmethod
    def get_matches(self, email: str) -> dict:
        raise NotImplementedError


class MatchQueryUseCaseImpl(MatchQueryUseCase, BaseModel):
    match_repository: MatchRepository
    user_repository: UserRepository

    class Config:
        arbitrary_types_allowed = True

    def get_matches(self, email: str) -> dict:
        try:
            user = self.user_repository.find_by_email(email)
            if not user:
                raise UserNotFoundError

            matches = self.match_repository.find_matches()
            return dict(
                matches=list(map(lambda match: MatchReadModel.from_entity(
                    match=match), matches))
            )

        except Exception as e:
            raise

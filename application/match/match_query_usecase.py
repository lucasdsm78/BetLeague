from abc import ABC, abstractmethod
from pydantic import BaseModel

from application.match.match_query_model import MatchReadModel
from domain.match.repository.match_repository import MatchRepository


class MatchQueryUseCase(ABC):

    @abstractmethod
    def fetch_matches(self) -> dict:
        raise NotImplementedError


class MatchQueryUseCaseImpl(MatchQueryUseCase, BaseModel):
    match_repository: MatchRepository

    class Config:
        arbitrary_types_allowed = True

    def fetch_matches(self) -> dict:
        try:
            matches = self.match_repository.find_matches()
            return dict(
                matches=list(map(lambda match: MatchReadModel.from_entity(
                    match=match), matches))
            )

        except Exception as e:
            raise

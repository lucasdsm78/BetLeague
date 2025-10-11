from abc import ABC, abstractmethod
from pydantic import BaseModel

from application.match.match_query_model import MatchReadModel
from domain.match.repository.match_repository import MatchRepository
from domain.user.exception.user_exception import UserNotFoundError
from domain.user.repository.user_repository import UserRepository


class MatchQueryUseCase(ABC):

    @abstractmethod
    async def get_matches(self, email: str, page: int = 1, page_size: int = 20) -> dict:
        raise NotImplementedError


class MatchQueryUseCaseImpl(MatchQueryUseCase, BaseModel):
    match_repository: MatchRepository
    user_repository: UserRepository

    class Config:
        arbitrary_types_allowed = True

    async def get_matches(self, email: str, page: int = 1, page_size: int = 20) -> dict:
        user = await self.user_repository.find_by_email(email)
        if not user:
            raise UserNotFoundError

        # clamp pagination params
        if page < 1:
            page = 1
        if page_size < 1:
            page_size = 1
        if page_size > 100:
            page_size = 100

        matches = await self.match_repository.find_matches()
        total = len(matches)

        # Compute pages
        total_pages = (total + page_size - 1) // page_size if page_size else 1
        start = (page - 1) * page_size
        end = start + page_size

        paginated = matches[start:end]

        return {
            "matches": [
                MatchReadModel.from_entity(match=match)
                for match in paginated
            ],
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": total_pages
        }

import logging
from abc import ABC, abstractmethod
from pydantic import BaseModel

from application.logging_utils import hash_identifier
from application.match.match_query_model import MatchReadModel, MatchesListResponse
from domain.match.repository.match_repository import MatchRepository
from domain.match.repository.match_odd_repository import MatchOddRepository
from domain.user.exception.user_exception import UserNotFoundError
from domain.user.repository.user_repository import UserRepository
from domain.match.model.match_odd import MatchOdd


logger = logging.getLogger(__name__)


class MatchQueryUseCase(ABC):

    @abstractmethod
    async def get_matches(self, email: str, page: int = 1, page_size: int = 20) -> MatchesListResponse:
        raise NotImplementedError


class MatchQueryUseCaseImpl(MatchQueryUseCase, BaseModel):
    match_repository: MatchRepository
    match_odd_repository: MatchOddRepository
    user_repository: UserRepository

    class Config:
        arbitrary_types_allowed = True

    async def get_matches(self, email: str, page: int = 1, page_size: int = 20) -> MatchesListResponse:
        user = await self.user_repository.find_by_email(email)
        if not user:
            logger.warning("match.query.list_rejected", extra={"email_hash": hash_identifier(email), "reason": "user_missing"})
            raise UserNotFoundError

        # clamp pagination params
        if page < 1:
            page = 1
        if page_size < 1:
            page_size = 1
        if page_size > 100:
            page_size = 100

        total = await self.match_repository.count_upcoming_matches()
        total_pages = (total + page_size - 1) // page_size if page_size else 1
        if page > max(total_pages, 1):
            page = max(total_pages, 1)

        matches = await self.match_repository.find_matches_paginated(page=page, page_size=page_size)
        match_ids = [m.id for m in matches]

        odds_by_match_id: dict[int, list[MatchOdd]] = {}
        if match_ids:
            all_odds = await self.match_odd_repository.find_by_match_ids(match_ids)
            for odd in all_odds:
                mid = int(odd.match_id)
                if mid <= 0:
                    continue
                odds_by_match_id.setdefault(mid, []).append(odd)

        response = MatchesListResponse(
            matches=[MatchReadModel.from_entity(match=m, odds=odds_by_match_id.get(m.id)) for m in matches],
            page=page,
            page_size=page_size,
            total=total,
            total_pages=total_pages,
        )
        logger.info(
            "match.query.list_loaded",
            extra={
                "user_id": user.id,
                "page": page,
                "page_size": page_size,
                "total": total,
                "results_count": len(matches),
                "match_ids_count": len(match_ids),
            },
        )
        return response

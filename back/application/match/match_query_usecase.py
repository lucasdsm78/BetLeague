from abc import ABC, abstractmethod
from pydantic import BaseModel

from application.match.match_query_model import MatchReadModel, MatchesListResponse
from domain.match.repository.match_repository import MatchRepository
from domain.match.repository.match_odd_repository import MatchOddRepository
from domain.user.exception.user_exception import UserNotFoundError
from domain.user.repository.user_repository import UserRepository
from domain.match.model.match_odd import MatchOdd


class MatchQueryUseCase(ABC):

    @abstractmethod
    async def get_matches(self, email: str, page: int = 1, page_size: int = 20) -> MatchesListResponse:
        raise NotImplementedError

    @abstractmethod
    async def get_match_odds_by_match_ids(self, email: str, match_ids: list[int]) -> dict[int, list[MatchOdd]]:
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

        return MatchesListResponse(
            matches=[MatchReadModel.from_entity(match=m, odds=odds_by_match_id.get(m.id)) for m in matches],
            page=page,
            page_size=page_size,
            total=total,
            total_pages=total_pages,
        )

    async def get_match_odds_by_match_ids(self, email: str, match_ids: list[int]) -> dict[int, list[MatchOdd]]:
        user = await self.user_repository.find_by_email(email)
        if not user:
            raise UserNotFoundError

        uniq = []
        seen: set[int] = set()
        for mid in match_ids or []:
            try:
                mid_int = int(mid)
            except Exception:
                continue
            if mid_int <= 0 or mid_int in seen:
                continue
            uniq.append(mid_int)
            seen.add(mid_int)
            if len(uniq) >= 500:
                break

        odds_by_match_id: dict[int, list[MatchOdd]] = {}
        if not uniq:
            return odds_by_match_id

        all_odds = await self.match_odd_repository.find_by_match_ids(uniq)
        for odd in all_odds:
            mid = int(odd.match_id)
            if mid <= 0:
                continue
            odds_by_match_id.setdefault(mid, []).append(odd)

        return odds_by_match_id

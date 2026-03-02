import logging
from abc import ABC, abstractmethod
from datetime import date
from typing import Callable

from sqlalchemy.ext.asyncio import AsyncSession

from domain.match.model.sport import Sport
from domain.services.match_fetch_api.match_fetch_api import MatchFetchApi
from infrastructure.postgresql.match.match_odd_repository import MatchOddRepositoryImpl
from infrastructure.postgresql.match.match_repository import MatchRepositoryImpl

logger = logging.getLogger(__name__)


class MatchFetchUseCase(ABC):

    @abstractmethod
    async def fetch_and_store_matches(
            self,
            sport: Sport,
            date_from: date,
            date_to: date,
    ) -> int:
        raise NotImplementedError


class MatchFetchUseCaseImpl(MatchFetchUseCase):

    def __init__(
            self,
            match_fetch_api: MatchFetchApi,
            session_factory: Callable[[], AsyncSession],
    ):
        self.match_fetch_api: MatchFetchApi = match_fetch_api
        self._session_factory = session_factory

    async def fetch_and_store_matches(
            self,
            sport: Sport,
            date_from: date,
            date_to: date,
    ) -> int:
        pairs = await self.match_fetch_api.get_upcoming_matches(
            sport=sport,
            date_from=date_from,
            date_to=date_to,
        )

        if not pairs:
            logger.info(f"No matches found for {sport.value} from {date_from} to {date_to}")
            return 0

        count = 0
        async with self._session_factory() as session:
            async with session.begin():
                match_repo = MatchRepositoryImpl(session=session)
                odd_repo = MatchOddRepositoryImpl(session=session)

                for match, odds in pairs:
                    upserted = await match_repo.upsert_by_api_fixture_id(match)
                    count += 1

                    if odds:
                        for o in odds:
                            o.match_id = upserted.id
                        await odd_repo.upsert_many_for_match(upserted.id, odds)

        logger.info(f"Upserted {count} {sport.value} matches (with odds) for {date_from} to {date_to}")
        return count

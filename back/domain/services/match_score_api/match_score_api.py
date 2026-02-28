from abc import ABC, abstractmethod
from datetime import datetime
from typing import List


class MatchScoreApi(ABC):

    @abstractmethod
    async def get_matches_finished(
            self,
            from_date: datetime,
            to_date: datetime
    ) -> list[dict]:
        raise NotImplementedError

    @abstractmethod
    async def get_live_scores(
            self,
            fixture_ids: List[int],
    ) -> list[dict]:
        raise NotImplementedError

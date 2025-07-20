from abc import ABC, abstractmethod
from datetime import datetime


class MatchScoreApi(ABC):

    @abstractmethod
    async def get_matches_finished(
            self,
            from_date: datetime,
            to_date: datetime
    ) -> list[dict]:
        raise NotImplementedError

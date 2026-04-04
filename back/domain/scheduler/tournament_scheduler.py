from abc import ABC, abstractmethod
from datetime import datetime


class TournamentScheduler(ABC):

    @abstractmethod
    async def process_tournaments(self, as_of: datetime | None = None):
        raise NotImplementedError

from abc import ABC, abstractmethod
from datetime import datetime


class LeaguePayoutScheduler(ABC):

    @abstractmethod
    async def process_due_payouts(self, as_of: datetime | None = None):
        raise NotImplementedError


from abc import ABC, abstractmethod


class TournamentScheduler(ABC):

    @abstractmethod
    async def process_tournaments(self):
        raise NotImplementedError

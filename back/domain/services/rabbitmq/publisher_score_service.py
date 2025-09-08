from abc import ABC, abstractmethod

from domain.match.event.match_winner_updated_event import MatchWinnerUpdatedEvent


class RabbitMQPublisherScoreService(ABC):

    @abstractmethod
    async def publish_match_winner_updated(self, event: MatchWinnerUpdatedEvent):
        raise NotImplementedError

    @abstractmethod
    async def connect(self) -> None:
        raise NotImplementedError

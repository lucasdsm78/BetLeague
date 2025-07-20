from abc import ABC, abstractmethod

from domain.ticket.event.match_choice_status_updated_event import MatchChoiceStatusUpdatedEvent


class RabbitMQPublisher(ABC):

    @abstractmethod
    async def publish_match_choice_status_updated(self, event: MatchChoiceStatusUpdatedEvent):
        raise NotImplementedError

    @abstractmethod
    async def connect(self) -> None:
        raise NotImplementedError

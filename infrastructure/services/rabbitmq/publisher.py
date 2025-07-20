import json
from typing import Optional

import aio_pika
from aio_pika.abc import AbstractRobustConnection, AbstractRobustChannel, AbstractRobustExchange

from domain.services.rabbitmq.publisher import RabbitMQPublisher
from domain.ticket.event.match_choice_status_updated_event import MatchChoiceStatusUpdatedEvent
from infrastructure.config import Settings


class RabbitMQPublisherImpl(RabbitMQPublisher):

    def __init__(
            self,
            settings: Settings,
            exchange_name: str = "match_choice_status_updates_exchange",
            routing_key: str = "match_choice_status_updates",
    ):
        self.settings = settings
        self.exchange_name = exchange_name
        self.routing_key = routing_key
        self._connection: Optional[AbstractRobustConnection] = None
        self._channel: Optional[AbstractRobustChannel] = None
        self._exchange: Optional[AbstractRobustExchange] = None

    async def connect(self) -> None:
        self._connection = await aio_pika.connect_robust(
            self.settings.rabbitmq_url,
            client_properties={"connection_name": "match_choice_publisher"},
            heartbeat=30
        )
        self._channel = await self._connection.channel(publisher_confirms=True)
        await self._channel.set_qos(prefetch_count=10)

        if self.exchange_name:
            self._exchange = await self._channel.declare_exchange(
                name=self.exchange_name,
                type=aio_pika.ExchangeType.DIRECT,
                durable=True,
            )
        else:
            self._exchange = self._channel.default_exchange

        queue = await self._channel.declare_queue(
            name=self.routing_key,
            durable=True
        )
        await queue.bind(self._exchange, routing_key=self.routing_key)

    async def _ensure_connected(self):
        if self._exchange is None or self._connection.is_closed:
            await self.connect()

    async def publish_match_choice_status_updated(
            self,
            event: MatchChoiceStatusUpdatedEvent
    ) -> None:
        await self._ensure_connected()
        if self._exchange is None:
            raise RuntimeError("Publisher not connected. Call connect() first.")

        payload = {
            "event_type": "MatchChoiceStatusUpdated",
            "ticket_id": event.ticket_id,
        }
        body = json.dumps(payload).encode()

        message = aio_pika.Message(
            body=body,
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT
        )
        await self._exchange.publish(
            message,
            routing_key=self.routing_key,
            mandatory=True
        )

    async def close(self) -> None:
        if self._channel and not self._channel.is_closed:
            await self._channel.close()
        if self._connection and not self._connection.is_closed:
            await self._connection.close()

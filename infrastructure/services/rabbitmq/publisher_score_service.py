from typing import Optional

import aio_pika
import orjson
from aio_pika.abc import AbstractRobustConnection, AbstractRobustExchange, AbstractRobustChannel

from domain.match.event.match_winner_updated_event import MatchWinnerUpdatedEvent
from domain.services.rabbitmq.publisher_score_service import RabbitMQPublisherScoreService
from infrastructure.config import Settings


class RabbitMQPublisherScoreServiceImpl(RabbitMQPublisherScoreService):

    def __init__(
            self,
            settings: Settings,
            exchange_name: str = "match_updates_exchange",
            routing_key: str = "match_updates",
    ):
        self._url = settings.rabbitmq_url
        self._exchange_name = exchange_name
        self._routing_key = routing_key
        self._connection: Optional[AbstractRobustConnection] = None
        self._channel: Optional[AbstractRobustChannel] = None
        self._exchange: Optional[AbstractRobustExchange] = None

    async def connect(self) -> None:
        self._connection = await aio_pika.connect_robust(
            self._url,
            client_properties={"connection_name": "match_winner_publisher"},
            heartbeat=30
        )
        self._channel = await self._connection.channel(publisher_confirms=True)

        if self._exchange_name:
            self._exchange = await self._channel.declare_exchange(
                name=self._exchange_name,
                type=aio_pika.ExchangeType.DIRECT,
                durable=True,
            )
        else:
            self._exchange = self._channel.default_exchange

        queue = await self._channel.declare_queue(
            name=self._routing_key,
            durable=True,
        )
        await queue.bind(self._exchange, routing_key=self._routing_key)

    async def _ensure_connected(self):
        if self._exchange is None or self._connection.is_closed:
            await self.connect()

    async def publish_match_winner_updated(self, event: MatchWinnerUpdatedEvent) -> None:
        await self._ensure_connected()

        if not self._exchange:
            raise RuntimeError("RabbitMQ publisher not connected. Call connect() first.")

        payload = {
            "event_type": "MatchWinnerUpdated",
            "match_id": event.match_id,
        }
        body = orjson.dumps(payload)

        message = aio_pika.Message(
            body=body,
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
        )

        await self._exchange.publish(
            message,
            routing_key=self._routing_key,
            mandatory=True,
        )

    async def close(self) -> None:
        if self._channel and not self._channel.is_closed:
            await self._channel.close()
        if self._connection and not self._connection.is_closed:
            await self._connection.close()

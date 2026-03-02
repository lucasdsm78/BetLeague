import asyncio
import logging
import os

import aio_pika
import orjson
from dotenv import load_dotenv

from application.ticket.ticket_command_usecase_factory import build_ticket_command_usecase
from domain.match.event.match_winner_updated_event import MatchUpdatedEvent
from infrastructure.config import Settings

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
load_dotenv()

NUM_WORKERS = int(os.getenv("NUM_WORKERS", "4"))


class MatchWinnerConsumer:

    QUEUE_NAME = "match_updates"
    PREFETCH_COUNT = 10

    def __init__(self, amqp_url: str):
        self.amqp_url = amqp_url
        self.settings = Settings()
        self._usecase = build_ticket_command_usecase(settings=self.settings)

    async def start(self):
        connection = await aio_pika.connect_robust(self.amqp_url)
        async with connection:
            channel = await connection.channel()
            await channel.set_qos(prefetch_count=self.PREFETCH_COUNT)

            queue = await channel.declare_queue(
                self.QUEUE_NAME, durable=True
            )

            logger.info(f"[Consumer] En attente de messages sur '{self.QUEUE_NAME}'...")

            async with queue.iterator() as queue_iter:
                async for message in queue_iter:
                    await self._on_message(message)

    async def _on_message(self, message: aio_pika.IncomingMessage):
        async with message.process(requeue=False):
            try:
                raw = orjson.loads(message.body)
                event = MatchUpdatedEvent(**raw)
                await self.handle_match_winner_updated(event)
                logger.info("[Consumer] Message traité avec succès.")
            except Exception:
                logger.exception("[Consumer] Erreur lors du traitement du message.")

    async def handle_match_winner_updated(self, event: MatchUpdatedEvent):
        logger.info(f"[Consumer] Traitement de MatchUpdatedEvent: match_id={event.match_id}")
        try:
            resp = await self._usecase.check_match_choices_by_match_id(
                token=os.getenv("SECRET_KEY_TOKEN"),
                match_id=event.match_id,
            )
            logger.info(f"[Consumer] Résultat: {resp}")
        except Exception:
            logger.exception("[Consumer] Erreur dans use-case")


async def main():
    amqp_url = os.getenv("RABBITMQ_URL")
    consumers = [
        MatchWinnerConsumer(amqp_url)
        for _ in range(NUM_WORKERS)
    ]

    tasks = [
        asyncio.create_task(consumer.start())
        for consumer in consumers
    ]

    await asyncio.gather(*tasks)


if __name__ == "__main__":
    asyncio.run(main())

import os
import asyncio
import logging

import aio_pika
from aio_pika import RobustConnection, RobustChannel, IncomingMessage
import uvloop
import orjson

from dotenv import load_dotenv
from dependency_injections import get_session, get_settings, get_async_session
from application.ticket.ticket_command_usecase_factory import build_ticket_command_usecase
from domain.ticket.event.match_choice_status_updated_event import MatchChoiceStatusUpdatedEvent
from domain.ticket.exception.ticket_exception import TicketNotFoundError
from domain.token.token_exception import TokenInvalidError
from domain.user.exception.user_exception import UserNotFoundError

# Utiliser uvloop pour un event loop ultra-rapide
asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())

load_dotenv()
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


class MatchChoiceConsumer:
    def __init__(
            self,
            rabbitmq_url: str,
            queue_name: str = "match_choice_status_updates",
            concurrency: int = 10,
    ):
        self.rabbitmq_url = rabbitmq_url
        self.queue_name = queue_name
        self.concurrency = concurrency
        self.settings = get_settings()
        self._connection: RobustConnection | None = None
        self._channel: RobustChannel | None = None
        self._queue = None
        # Pour arrêter proprement les workers
        self._stop_event = asyncio.Event()

    async def _connect(self) -> None:
        backoff = 1
        while not self._stop_event.is_set():
            try:
                logger.info("[Consumer] Connexion à RabbitMQ…")
                self._connection = await aio_pika.connect_robust(self.rabbitmq_url)
                self._channel = await self._connection.channel()
                # QoS = nombre max de messages non acquittés par consumer
                await self._channel.set_qos(prefetch_count=self.concurrency)
                self._queue = await self._channel.declare_queue(
                    self.queue_name,
                    durable=True
                )
                logger.info(f"[Consumer] Connecté, concurrency={self.concurrency}")
                return
            except Exception:
                logger.exception(
                    f"[Consumer] Impossible de se connecter, nouvel essai dans {backoff}s…"
                )
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 30)

    async def start(self) -> None:
        """
        Lance plusieurs workers parallèles (limités par `concurrency`) qui consomment chacun
        de la même queue.
        """
        await self._connect()
        workers = [
            asyncio.create_task(self._worker_loop(worker_id=i))
            for i in range(self.concurrency)
        ]
        try:
            await asyncio.gather(*workers)
        except asyncio.CancelledError:
            logger.info("[Consumer] Arrêt demandé, fermeture des workers…")
            self._stop_event.set()
            await self._shutdown()
            raise

    async def _worker_loop(self, worker_id: int) -> None:
        async with self._queue.iterator() as queue_iter:
            async for message in queue_iter:
                # `message.process()` gère ack/nack automatiquement
                await self._handle_message(message)

    async def _handle_message(self, message: IncomingMessage) -> None:
        async with message.process(requeue=False):
            try:
                # orjson est plus rapide que json
                payload = orjson.loads(message.body)
                event = MatchChoiceStatusUpdatedEvent(**payload)
            except Exception as e:
                logger.error(f"[Consumer] payload invalide ou parse erreur : {e}")
                return

            try:
                async with get_async_session() as session:
                    ticket_uc = build_ticket_command_usecase(
                        settings=self.settings, session=session
                    )
                    secret = os.getenv("SECRET_KEY_TOKEN", "")
                    await ticket_uc.check_ticket_status(
                        token=secret, ticket_id=event.ticket_id
                    )
                logger.info(
                    f"[Worker] Ticket {event.ticket_id} checké avec succès."
                )
            except (TokenInvalidError, TicketNotFoundError, UserNotFoundError) as domain_err:
                # Erreurs business : on log et on ack
                logger.warning(f"[Worker] Erreur métier (non requeue) : {domain_err}")
            except Exception as exc:
                # Erreur inattendue : nack sans requeue
                logger.exception(
                    f"[Worker] Erreur critique sur ticket {event.ticket_id} : {exc}"
                )

    async def _shutdown(self) -> None:
        # Ferme proprement le channel et la connexion
        if self._channel and not self._channel.is_closed:
            await self._channel.close()
        if self._connection and not self._connection.is_closed:
            await self._connection.close()
        logger.info("[Consumer] Connexion RabbitMQ fermée.")


async def run_consumer() -> None:
    rabbitmq_url = os.getenv("RABBITMQ_URL", "")
    consumer = MatchChoiceConsumer(rabbitmq_url=rabbitmq_url, concurrency=10)
    try:
        await consumer.start()
    except KeyboardInterrupt:
        logger.info("[Main] Interrupt reçu, arrêt…")


if __name__ == "__main__":
    asyncio.run(run_consumer())

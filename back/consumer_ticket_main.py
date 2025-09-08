import asyncio
import signal
import logging

import uvloop

from infrastructure.services.rabbitmq.match_choice_updated_consumer import run_consumer

asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


def _handle_shutdown(loop: asyncio.AbstractEventLoop):
    for task in asyncio.all_tasks(loop):
        task.cancel()


def main() -> None:
    loop = asyncio.get_event_loop()

    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, lambda: _handle_shutdown(loop))

    try:
        loop.run_until_complete(run_consumer())
    except asyncio.CancelledError:
        logger.info("Arrêt gracieux reçu, fermeture…")
    finally:
        loop.close()
        logger.info("Event loop fermé.")


if __name__ == "__main__":
    main()

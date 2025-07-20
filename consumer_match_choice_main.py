import os
import asyncio
import signal
from dotenv import load_dotenv

from infrastructure.services.rabbitmq.match_score_updated_consumer import MatchWinnerConsumer

load_dotenv()
AMQP_URL    = os.getenv("RABBITMQ_URL")
NUM_WORKERS = int(os.getenv("NUM_WORKERS", "4"))

async def main():
    consumers = [
        MatchWinnerConsumer(amqp_url=AMQP_URL)
        for _ in range(NUM_WORKERS)
    ]
    tasks = [asyncio.create_task(cons.start()) for cons in consumers]

    stop = asyncio.Event()
    for sig in (signal.SIGINT, signal.SIGTERM):
        asyncio.get_running_loop().add_signal_handler(sig, stop.set)

    await stop.wait()
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)

if __name__ == "__main__":
    asyncio.run(main())

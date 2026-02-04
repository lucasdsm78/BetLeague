from __future__ import annotations

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import AsyncIterator

import redis  # sync redis client

logger = logging.getLogger(__name__)


class ThreadedRedisPubSubSubscriber:
    """Subscriber Redis Pub/Sub robuste (sync dans un thread).

    Pourquoi: certains combos uvloop + redis.asyncio pubsub peuvent être instables.
    Ce subscriber utilise redis-py sync dans un thread et repousse les messages
    dans une asyncio.Queue, ce qui est fiable pour un endpoint SSE.

    - 1 thread par connexion SSE.
    - Annulation propre via un Event + pubsub.close().
    """

    def __init__(self, *, redis_url: str, channel: str):
        self._redis_url = redis_url
        self._channel = channel

    async def subscribe(self) -> AsyncIterator[str]:
        loop = asyncio.get_running_loop()
        queue: asyncio.Queue[str] = asyncio.Queue(maxsize=200)
        stop = asyncio.Event()

        def _run() -> None:
            r = redis.Redis.from_url(self._redis_url)
            # IMPORTANT: on n'ignore pas les subscribe messages pour détecter l'ACK.
            pubsub = r.pubsub(ignore_subscribe_messages=False)
            try:
                pubsub.subscribe(self._channel)

                # Attendre l'ACK d'abonnement
                for msg in pubsub.listen():
                    if stop.is_set():
                        return
                    if msg and msg.get("type") == "subscribe":
                        break

                # Maintenant on peut ignorer les subscribe messages
                pubsub.ignore_subscribe_messages = True

                for msg in pubsub.listen():
                    if stop.is_set():
                        break
                    if not msg or msg.get("type") != "message":
                        continue
                    data = msg.get("data")
                    if isinstance(data, (bytes, bytearray)):
                        text = data.decode("utf-8")
                    else:
                        text = str(data)
                    # push vers l'event loop (best-effort si la queue est pleine)
                    try:
                        loop.call_soon_threadsafe(queue.put_nowait, text)
                    except Exception:
                        pass
            except Exception:
                logger.exception("redis.threaded_pubsub_failed")
            finally:
                try:
                    pubsub.close()
                except Exception:
                    pass
                try:
                    r.close()
                except Exception:
                    pass

        # Exécute le listener dans un thread
        executor = ThreadPoolExecutor(max_workers=1)
        task = loop.run_in_executor(executor, _run)

        try:
            while True:
                item = await queue.get()
                yield item
        finally:
            stop.set()
            try:
                await asyncio.wait_for(asyncio.wrap_future(task), timeout=2)
            except Exception:
                pass
            executor.shutdown(wait=False)

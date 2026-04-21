from __future__ import annotations

import asyncio
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from threading import Event as ThreadEvent
from typing import AsyncIterator

import redis  # sync redis client

logger = logging.getLogger(__name__)


def _channel_hint(channel: str) -> str:
    return (channel or "").split(":")[-1][:64] or "unknown"


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

    def _build_client(self) -> redis.Redis:
        return redis.Redis.from_url(
            self._redis_url,
            socket_connect_timeout=2,
            socket_timeout=None,
            health_check_interval=30,
            retry_on_timeout=False,
            socket_keepalive=True,
        )

    async def subscribe(self) -> AsyncIterator[str]:
        loop = asyncio.get_running_loop()
        queue: asyncio.Queue[str] = asyncio.Queue(maxsize=200)
        stop = ThreadEvent()
        logger.info("redis.threaded_pubsub.opened", extra={"channel_hint": _channel_hint(self._channel)})

        def _run() -> None:
            reconnect_delay_s = 1.0
            while not stop.is_set():
                r: redis.Redis | None = None
                pubsub = None
                try:
                    r = self._build_client()
                    # IMPORTANT: on n'ignore pas les subscribe messages pour détecter l'ACK.
                    pubsub = r.pubsub(ignore_subscribe_messages=False)
                    pubsub.subscribe(self._channel)

                    # Attendre l'ACK d'abonnement
                    for msg in pubsub.listen():
                        if stop.is_set():
                            return
                        if msg and msg.get("type") == "subscribe":
                            logger.info("redis.threaded_pubsub.subscribed", extra={"channel_hint": _channel_hint(self._channel)})
                            break

                    # Maintenant on peut ignorer les subscribe messages
                    pubsub.ignore_subscribe_messages = True

                    for msg in pubsub.listen():
                        if stop.is_set():
                            return
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
                except redis.exceptions.RedisError:
                    if stop.is_set():
                        return
                    logger.warning(
                        "redis.threaded_pubsub.reconnecting",
                        extra={"channel_hint": _channel_hint(self._channel), "delay_s": reconnect_delay_s},
                        exc_info=True,
                    )
                    time.sleep(reconnect_delay_s)
                except Exception:
                    if stop.is_set():
                        return
                    logger.exception("redis.threaded_pubsub.failed", extra={"channel_hint": _channel_hint(self._channel)})
                    time.sleep(reconnect_delay_s)
                finally:
                    try:
                        if pubsub is not None:
                            pubsub.close()
                    except Exception:
                        pass
                    try:
                        if r is not None:
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
            logger.info("redis.threaded_pubsub.closed", extra={"channel_hint": _channel_hint(self._channel)})

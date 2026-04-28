from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from typing import Any, DefaultDict, Type, TypeVar

from domain.utils.domain_event import DomainEvent

E = TypeVar('E', bound=DomainEvent)
Handler = Callable[[E], Awaitable[None]]


logger = logging.getLogger(__name__)


class DomainEventBus:
    async def publish(self, event: DomainEvent) -> None:
        raise NotImplementedError


class InProcessDomainEventBus(DomainEventBus):

    def __init__(self):
        self._handlers: DefaultDict[Type[DomainEvent], list[Callable[[Any], Awaitable[None]]]] = DefaultDict(list)

    def subscribe(self, event_type: Type[E], handler: Handler[E]) -> None:
        self._handlers[event_type].append(handler)
        logger.info(
            "event_bus.inprocess.subscribed",
            extra={
                "event_type": getattr(event_type, "__name__", str(event_type)),
                "handler": getattr(handler, "__name__", repr(handler)),
                "handlers_count": len(self._handlers[event_type]),
            },
        )

    async def publish(self, event: DomainEvent) -> None:
        handlers = list(self._handlers.get(type(event), []))
        logger.info(
            "event_bus.inprocess.publish",
            extra={
                "event_type": type(event).__name__,
                "handlers_count": len(handlers),
            },
        )
        for h in handlers:
            await h(event)


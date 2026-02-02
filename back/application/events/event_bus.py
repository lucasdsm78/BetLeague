from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any, DefaultDict, Type, TypeVar

from domain.utils.domain_event import DomainEvent

E = TypeVar('E', bound=DomainEvent)
Handler = Callable[[E], Awaitable[None]]


class DomainEventBus:
    async def publish(self, event: DomainEvent) -> None:
        raise NotImplementedError


class InProcessDomainEventBus(DomainEventBus):

    def __init__(self):
        self._handlers: DefaultDict[Type[DomainEvent], list[Callable[[Any], Awaitable[None]]]] = DefaultDict(list)

    def subscribe(self, event_type: Type[E], handler: Handler[E]) -> None:
        self._handlers[event_type].append(handler)

    async def publish(self, event: DomainEvent) -> None:
        handlers = list(self._handlers.get(type(event), []))
        for h in handlers:
            await h(event)


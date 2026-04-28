from __future__ import annotations


class DomainEvent:

    __slots__ = ("event_name",)

    def __init__(self, event_name: str):
        self.event_name = event_name

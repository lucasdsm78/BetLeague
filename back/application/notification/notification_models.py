from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class NotificationReadModel(BaseModel):
    id: int
    user_id: int
    type: str
    title: str
    message: str
    data: dict[str, Any] = Field(default_factory=dict)
    created_at: int
    read_at: Optional[int] = None


class NotificationListResponse(BaseModel):
    items: list[NotificationReadModel]
    next_cursor: Optional[str] = None


class UnreadCountResponse(BaseModel):
    count: int


class MarkAllReadResponse(BaseModel):
    updated: int


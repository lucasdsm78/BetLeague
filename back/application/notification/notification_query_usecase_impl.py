from __future__ import annotations

from typing import Callable, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from application.notification.notification_query_usecase import NotificationQueryUseCase
from domain.notification.model.notification import Notification
from domain.notification.repository.notification_repository import NotificationRepository


class NotificationQueryUseCaseImpl(NotificationQueryUseCase):
    def __init__(
        self,
        *,
        notification_repository: NotificationRepository,
        session_factory: Callable[[], AsyncSession],
    ):
        self._notification_repository = notification_repository
        self._session_factory = session_factory

    async def list_for_user(
        self, *, user_id: int, limit: int, cursor: Optional[str]
    ) -> tuple[list[Notification], Optional[str]]:
        async with self._session_factory() as session:
            items, next_cursor = await self._notification_repository.list_by_user(
                user_id=user_id,
                limit=limit,
                cursor=cursor,
            )
            # read-only
            await session.rollback()
        return items, next_cursor

    async def unread_count(self, *, user_id: int) -> int:
        async with self._session_factory() as session:
            count = await self._notification_repository.unread_count(user_id=user_id)
            await session.rollback()
        return count

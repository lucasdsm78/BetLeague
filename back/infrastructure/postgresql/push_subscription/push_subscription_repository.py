from __future__ import annotations

from typing import Optional

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from domain.push_subscription.model.push_subscription import PushSubscription
from domain.push_subscription.repository.push_subscription_repository import PushSubscriptionRepository
from infrastructure.postgresql.push_subscription.db_push_subscription import DBPushSubscription


class PushSubscriptionRepositoryImpl(PushSubscriptionRepository):

    def __init__(self, session: AsyncSession):
        self._session = session

    async def create(self, subscription: PushSubscription) -> PushSubscription:
        db = DBPushSubscription.from_entity(subscription)
        self._session.add(db)
        await self._session.flush()
        await self._session.refresh(db)
        return db.to_entity()

    async def find_by_endpoint(self, endpoint: str) -> Optional[PushSubscription]:
        stmt = select(DBPushSubscription).where(DBPushSubscription.endpoint == endpoint)
        result = await self._session.execute(stmt)
        row = result.scalar_one_or_none()
        return row.to_entity() if row else None

    async def find_by_user_id(self, user_id: int) -> list[PushSubscription]:
        stmt = (
            select(DBPushSubscription)
            .where(DBPushSubscription.user_id == user_id)
            .order_by(DBPushSubscription.created_at.desc())
        )
        result = await self._session.execute(stmt)
        rows = result.scalars().all()
        return [row.to_entity() for row in rows]

    async def delete_by_endpoint(self, endpoint: str) -> None:
        stmt = delete(DBPushSubscription).where(DBPushSubscription.endpoint == endpoint)
        await self._session.execute(stmt)

    async def delete_by_user_id(self, user_id: int) -> int:
        stmt = delete(DBPushSubscription).where(DBPushSubscription.user_id == user_id)
        result = await self._session.execute(stmt)
        return result.rowcount

    async def update_last_used(self, subscription_id: int, last_used_at: int) -> None:
        stmt = (
            update(DBPushSubscription)
            .where(DBPushSubscription.id == subscription_id)
            .values(last_used_at=last_used_at)
        )
        await self._session.execute(stmt)

    async def delete_by_id(self, subscription_id: int) -> None:
        stmt = delete(DBPushSubscription).where(DBPushSubscription.id == subscription_id)
        await self._session.execute(stmt)

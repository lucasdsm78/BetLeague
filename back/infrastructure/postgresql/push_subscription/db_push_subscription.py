from __future__ import annotations

from typing import Optional, Union

from sqlalchemy import BigInteger, Column, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship

from infrastructure.postgresql.database import Base
from domain.push_subscription.model.push_subscription import PushSubscription


class DBPushSubscription(Base):

    __tablename__ = "push_subscription"

    id: Union[int, Column] = Column(Integer, primary_key=True, autoincrement=True)
    user_id: Union[int, Column] = Column(
        BigInteger,
        ForeignKey("user.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    endpoint: Union[str, Column] = Column(Text, nullable=False, unique=True)
    p256dh_key: Union[str, Column] = Column(String(255), nullable=False)
    auth_key: Union[str, Column] = Column(String(64), nullable=False)
    user_agent: Union[Optional[str], Column] = Column(String(512), nullable=True)
    created_at: Union[int, Column] = Column(BigInteger, nullable=False, index=True)
    last_used_at: Union[Optional[int], Column] = Column(BigInteger, nullable=True)

    user = relationship("DBUser", lazy="selectin")

    __table_args__ = (
        Index("ix_push_subscription_user_created", "user_id", "created_at"),
    )

    def to_entity(self) -> PushSubscription:
        return PushSubscription(
            id=self.id,
            user_id=self.user_id,
            endpoint=self.endpoint,
            p256dh_key=self.p256dh_key,
            auth_key=self.auth_key,
            user_agent=self.user_agent,
            created_at=self.created_at,
            last_used_at=self.last_used_at,
        )

    @staticmethod
    def from_entity(
        subscription: PushSubscription,
        db_subscription: Optional["DBPushSubscription"] = None,
    ) -> "DBPushSubscription":
        db = db_subscription if db_subscription is not None else DBPushSubscription()
        if subscription.id is not None:
            db.id = subscription.id
        db.user_id = subscription.user_id
        db.endpoint = subscription.endpoint
        db.p256dh_key = subscription.p256dh_key
        db.auth_key = subscription.auth_key
        db.user_agent = subscription.user_agent
        db.created_at = subscription.created_at
        db.last_used_at = subscription.last_used_at
        return db

from __future__ import annotations

from typing import Any, Optional, Union

from sqlalchemy import BigInteger, Column, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from domain.notification.model.notification import Notification, NotificationType
from infrastructure.postgresql.database import Base


class DBNotification(Base):
    __tablename__ = "notification"

    id: Union[int, Column] = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id: Union[int, Column] = Column(BigInteger, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)

    type: Union[str, Column] = Column(String(80), nullable=False, index=True)
    title: Union[str, Column] = Column(String(150), nullable=False)
    message: Union[str, Column] = Column(String(600), nullable=False)
    data: Union[dict[str, Any], Column] = Column(JSONB, nullable=False, default=dict)

    created_at: Union[int, Column] = Column(BigInteger, nullable=False, index=True)
    read_at: Union[Optional[int], Column] = Column(BigInteger, nullable=True, index=True)

    user = relationship("DBUser", lazy="selectin")

    def to_entity(self) -> Notification:
        try:
            n_type = NotificationType(self.type)
        except Exception:
            n_type = NotificationType.GENERIC

        return Notification(
            id=self.id,
            user_id=self.user_id,
            type=n_type,
            title=self.title,
            message=self.message,
            data=self.data or {},
            created_at=self.created_at,
            read_at=self.read_at,
        )

    @staticmethod
    def from_entity(notification: Notification, db_notification: Optional["DBNotification"] = None) -> "DBNotification":
        db = db_notification if db_notification is not None else DBNotification()
        db.id = notification.id
        db.user_id = notification.user_id
        db.type = str(notification.type)
        db.title = notification.title
        db.message = notification.message
        db.data = dict(notification.data)
        db.created_at = notification.created_at
        db.read_at = notification.read_at
        return db

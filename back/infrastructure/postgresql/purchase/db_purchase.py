from datetime import datetime
from typing import Union, Optional

from sqlalchemy import Column, Integer, String, BigInteger, ForeignKey, Float, Index
from sqlalchemy.orm import relationship

from domain.purchase.model.pack_summary import PackSummary
from domain.purchase.model.purchase import Purchase
from domain.purchase.model.purchase_status import PurchaseStatus
from domain.user.model.email import Email
from domain.user.model.user_summary import UserSummary
from infrastructure.postgresql.database import Base


def unixtimestamp() -> int:
    # Always use UTC to avoid timezone-dependent shifts
    return int(datetime.utcnow().timestamp() * 1000)


class DBPurchase(Base):

    __tablename__ = "purchase"
    __table_args__ = (
        Index("ix_purchase_pack_id", "pack_id"),
        Index("ix_purchase_user_created_id", "user_id", "created_at", "id"),
    )

    id: Union[int, Column] = Column(Integer, primary_key=True, autoincrement=True)
    uuid: Union[str, Column] = Column(String, nullable=False, unique=True, index=True)
    stripe_session_id: Union[str, Column] = Column(String, nullable=True, index=True)
    status: Union[str, Column] = Column(String, nullable=False)
    user_id: Union[int, Column] = Column(Integer, ForeignKey('user.id'))
    pack = relationship("DBPack", back_populates='purchases', lazy='joined')
    pack_id: Union[int, Column] = Column(Integer, ForeignKey('pack.id'))
    user = relationship("DBUser", back_populates='purchases', lazy='joined')
    created_at: Union[int, Column] = Column(BigInteger, index=True, nullable=False)

    def to_entity(self) -> Purchase:
        return Purchase(
            id=self.id,
            stripe_session_id=self.stripe_session_id,
            uuid=self.uuid,
            status=PurchaseStatus.from_str(self.status),
            pack=PackSummary(
                id=self.pack_id,
                name=self.pack.name,
                price_cents=self.pack.price_cents,
                total_btl=self.pack.total_btl,
            ),
            created_at=self.created_at,
            user=UserSummary(id=self.user_id, email=Email(self.user.email), pseudo=self.user.pseudo),
        )

    @staticmethod
    def from_entity(purchase: Purchase, db_purchase: Optional["DBPurchase"] = None) -> "DBPurchase":
        now = unixtimestamp()
        purchase_db_to_update = db_purchase if db_purchase is not None else DBPurchase()
        purchase_db_to_update.id = purchase.id
        purchase_db_to_update.uuid = purchase.uuid
        purchase_db_to_update.stripe_session_id = purchase.stripe_session_id
        purchase_db_to_update.status = purchase.status.value
        purchase_db_to_update.user_id = purchase.user.id
        purchase_db_to_update.pack_id = purchase.pack.id
        # Preserve original creation time when updating
        purchase_db_to_update.created_at = purchase_db_to_update.created_at if db_purchase is not None else now
        return purchase_db_to_update

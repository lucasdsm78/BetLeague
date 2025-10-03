from datetime import datetime
from typing import Union, Optional

from sqlalchemy import Column, Integer, String, BigInteger, ForeignKey, Float
from sqlalchemy.orm import relationship

from domain.purchase.model.pack import Pack
from infrastructure.postgresql.database import Base


def unixtimestamp() -> int:
    # Always use UTC to avoid timezone-dependent shifts
    return int(datetime.utcnow().timestamp() * 1000)


class DBPack(Base):

    __tablename__ = "pack"
    id: Union[int, Column] = Column(Integer, primary_key=True, autoincrement=True, index=True)
    name: Union[str, Column] = Column(String, nullable=False, unique=True, index=True)
    price_cents: Union[int, Column] = Column(Integer)
    nb_btl: Union[float, Column] = Column(Float, nullable=False)
    bonus: Union[float, Column] = Column(Float, nullable=False)
    total_btl: Union[float, Column] = Column(Float, nullable=False)
    price_per_100: Union[float, Column] = Column(Float, nullable=False)
    note         = Column(String,  nullable=True)
    created_at: Union[int, Column] = Column(BigInteger, index=True, nullable=False)
    purchases = relationship("DBPurchase", back_populates="pack")

    def to_entity(self) -> Pack:
        return Pack(
            id=self.id,
            name=self.name,
            price_cents=self.price_cents,
            nb_btl=self.nb_btl,
            bonus=self.bonus,
            total_btl=self.total_btl,
            price_per_100=self.price_per_100,
            note=self.note,
            created_at=self.created_at,
        )

    @staticmethod
    def from_entity(pack: Pack, db_pack: Optional["Pack"] = None) -> "DBPack":
        now = unixtimestamp()
        pack_db_to_update = db_pack if db_pack is not None else DBPack()
        pack_db_to_update.id = pack.id
        pack_db_to_update.name = pack.name
        pack_db_to_update.price_cents = pack.price_cents
        pack_db_to_update.nb_btl = pack.nb_btl
        pack_db_to_update.bonus = pack.bonus
        pack_db_to_update.total_btl = pack.total_btl
        pack_db_to_update.price_per_100 = pack.price_per_100
        pack_db_to_update.note = pack.note
        # Preserve original creation time when updating
        pack_db_to_update.created_at = pack_db_to_update.created_at if db_pack is not None else now
        return pack_db_to_update

from typing import Optional

from sqlalchemy import select
from sqlalchemy.exc import NoResultFound

from domain.purchase.exception.purchase_exception import PurchaseNotFoundError
from domain.purchase.model.purchase import Purchase
from domain.purchase.repository.purchase_repository import PurchaseRepository
from infrastructure.postgresql.purchase.db_purchase import DBPurchase
from sqlalchemy.ext.asyncio import AsyncSession


class PurchaseRepositoryImpl(PurchaseRepository):

    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def create(self, purchase: Purchase):
        purchase_db = DBPurchase.from_entity(purchase)
        try:
            self.session.add(purchase_db)
        except:
            raise

    async def find_by_id(self, purchase_id: int) -> Optional[Purchase]:
        try:
            purchase_db = await self.session.execute(
                select(DBPurchase).where(DBPurchase.id == purchase_id)
            )
            result = purchase_db.scalar_one_or_none()
            if result is None:
                return None
        except NoResultFound:
            raise PurchaseNotFoundError
        except Exception as e:
            raise
        return purchase_db.to_entity()

    async def find_by_uuid(self, uuid: str) -> Optional[Purchase]:
        try:
            result = await self.session.execute(
                select(DBPurchase).where(DBPurchase.uuid == uuid)
            )
            purchase_db = result.scalar_one_or_none()
            if purchase_db is None:
                return None
            return purchase_db.to_entity()
        except NoResultFound:
            return None
        except Exception as e:
            raise e

    async def find_by_intent(self, intent_id: str) -> Optional[Purchase]:
        try:
            purchase_db = await self.session.execute(
                select(DBPurchase).where(DBPurchase.stripe_session_id == intent_id)
            )
            result = purchase_db.scalar_one_or_none()
            if result is None:
                return None
            return result.to_entity()
        except NoResultFound:
            return None
        except Exception as e:
            raise

    async def update(self, purchase: Purchase) -> None:
        result = await self.session.execute(
            select(DBPurchase).where(DBPurchase.id == purchase.id)
        )

        db_purchase = result.scalar_one_or_none()

        if db_purchase is None:
            raise PurchaseNotFoundError

        DBPurchase.from_entity(purchase, db_purchase)

    async def begin(self):
        await self.session.begin()

    async def commit(self):
        await self.session.commit()

    async def rollback(self):
        await self.session.rollback()

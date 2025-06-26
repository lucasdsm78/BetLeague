from typing import Optional

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
            purchase_db = await self.session.get(DBPurchase, {"id": purchase_id})
        except NoResultFound:
            raise PurchaseNotFoundError
        except Exception as e:
            raise
        return purchase_db.to_entity()

    async def begin(self):
        await self.session.begin()

    async def commit(self):
        await self.session.commit()

    async def rollback(self):
        await self.session.rollback()

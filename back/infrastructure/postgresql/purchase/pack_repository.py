from typing import Optional, List
from sqlalchemy import select

from sqlalchemy.exc import NoResultFound
from sqlalchemy.ext.asyncio import AsyncSession

from domain.purchase.model.pack import Pack
from domain.purchase.repository.pack_repository import PackRepository
from infrastructure.postgresql.purchase.db_pack import DBPack


class PackRepositoryImpl(PackRepository):

    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def find_by_id(self, pack_id: int) -> Optional[Pack]:
        try:
            result = await self.session.execute(
                select(DBPack).where(DBPack.id == pack_id)
            )
            pack_db = result.scalar_one_or_none()
            if pack_db is None:
                return None

        except NoResultFound:
            return None
        except Exception as e:
            raise

        return pack_db.to_entity()

    async def find_all(self) -> List[Pack]:
        try:
            result = await self.session.execute(
                select(DBPack).order_by(DBPack.price_cents.asc())
            )
            packs_db = result.scalars().all()
            return [pack.to_entity() for pack in packs_db]

        except Exception as e:
            raise

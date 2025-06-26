from typing import Optional

from sqlalchemy.exc import NoResultFound
from sqlalchemy.orm.session import Session

from domain.purchase.exception.pack_exception import PackNotFoundError
from domain.purchase.model.pack import Pack
from domain.purchase.repository.pack_repository import PackRepository
from infrastructure.postgresql.purchase.db_pack import DBPack


class PackRepositoryImpl(PackRepository):

    def __init__(self, session: Session):
        self.session: Session = session

    async def find_by_id(self, pack_id: int) -> Optional[Pack]:
        try:
            pack_db = self.session.query(DBPack).filter_by(id=pack_id).one()
        except NoResultFound:
            raise PackNotFoundError
        except Exception as e:
            raise
        return pack_db.to_entity()

from typing import Optional, List, Dict
from sqlalchemy import func, select, or_
from sqlalchemy.exc import NoResultFound
from sqlalchemy.ext.asyncio import AsyncSession

from domain.user.exception.user_exception import UserNotFoundError
from domain.user.model.user import User
from domain.user.repository.user_repository import UserRepository
from infrastructure.postgresql.user.db_user import DBUser


class UserRepositoryImpl(UserRepository):

    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def find_by_email(self, email: str) -> Optional[User]:
        try:
            result = await self.session.execute(
                select(DBUser).where(DBUser.email == email)
            )
            user_db = result.scalar_one_or_none()
            if user_db is None:
                return None
            return user_db.to_entity()
        except:
            raise

    async def find_by_pseudo_or_email(
            self,
            pseudo: Optional[str] = None,
            email: Optional[str] = None
    ) -> Optional[User]:
        filters = []
        if pseudo:
            filters.append(DBUser.pseudo == pseudo)
        if email:
            filters.append(DBUser.email == email)
        if not filters:
            return None
        stmt = select(DBUser).where(or_(*filters))
        result = await self.session.execute(stmt)
        user_db = result.scalar_one_or_none()
        return user_db.to_entity() if user_db else None

    async def find_by_pseudo(self, pseudo: str) -> Optional[User]:
        try:
            result = await self.session.execute(
                select(DBUser).where(DBUser.pseudo == pseudo)
            )
            user_db = result.scalar_one_or_none()
            if user_db is None:
                return None
            return user_db.to_entity()
        except:
            raise

    async def find_by_id(self, user_id: int) -> Optional[User]:
        try:
            result = await self.session.execute(
                select(DBUser).where(DBUser.id == user_id)
            )
            user_db = result.scalar_one()
            return user_db.to_entity()
        except NoResultFound:
            raise UserNotFoundError
        except:
            raise

    async def create(self, user: User):
        user_db = DBUser.from_entity(user)
        try:
            self.session.add(user_db)
        except:
            raise

    async def find_users(self) -> List[User]:
        try:
            result = await self.session.execute(
                select(DBUser).order_by(DBUser.pseudo)
            )
            user_dbs = result.scalars().all()
            if not user_dbs:
                return []
            return [user_db.to_entity() for user_db in user_dbs]
        except:
            raise

    async def delete_user(self, user_id: int):
        try:
            result = await self.session.execute(
                select(DBUser).where(DBUser.id == user_id)
            )
            db_user = result.scalar_one()

            await self.session.delete(db_user)
        except:
            raise

    async def update(self, user: User):
        try:
            result = await self.session.execute(
                select(DBUser).where(DBUser.id == user.id)
            )
            _user = result.scalar_one()
            user_db = DBUser.from_entity(user, _user)
        except:
            raise

    async def get_all_rank_users(self) -> List[Dict[str, any]]:
        try:
            result = await self.session.execute(
                select(
                    DBUser.nb_btl.label("nb_btl"),
                    DBUser.nb_win.label("nb_win"),
                    DBUser.nb_lose.label("nb_lose"),
                    DBUser.pseudo.label("pseudo"),
                    func.rank().over(
                        order_by=DBUser.nb_btl.desc()
                    ).label("position")
                ).order_by(DBUser.nb_btl.desc())
            )
            ranking_result = result.all()

            return [
                {
                    "nb_btl": row.nb_btl,
                    "nb_win": row.nb_win,
                    "nb_lose": row.nb_lose,
                    "pseudo": row.pseudo,
                    "position": row.position
                }
                for row in ranking_result
            ]
        except Exception as e:
            raise e

    async def credit_btl(self, user_id: int, amount: float):
        try:
            result = await self.session.execute(
                select(DBUser).where(DBUser.id == user_id)
            )
            user = result.scalar_one()
            user.nb_btl += amount
            return user.to_entity()
        except NoResultFound:
            raise UserNotFoundError
        except:
            raise

    async def begin(self):
        await self.session.begin()

    async def commit(self):
        await self.session.commit()

    async def rollback(self):
        await self.session.rollback()

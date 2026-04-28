from datetime import UTC, datetime
from typing import Optional, List, Dict

import shortuuid
from sqlalchemy import func, select, or_, update
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
                select(DBUser).where(DBUser.email == email, DBUser.deleted_at.is_(None))
            )
            user_db = result.scalar_one_or_none()
            if user_db is None:
                return None
            return user_db.to_entity()
        except:
            raise

    async def find_users_by_ids(self, user_ids: list[int]) -> dict[int, User]:
        try:
            result = await self.session.execute(
                select(DBUser).where(DBUser.id.in_(user_ids), DBUser.deleted_at.is_(None))
            )
            users_db = result.scalars().all()
            return {user.id: user.to_entity() for user in users_db}
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

        stmt = select(DBUser).where(or_(*filters), DBUser.deleted_at.is_(None))
        result = await self.session.execute(stmt)
        user_db = result.scalar_one_or_none()
        return user_db.to_entity() if user_db else None

    async def find_by_pseudo(self, pseudo: str) -> Optional[User]:
        try:
            result = await self.session.execute(
                select(DBUser).where(DBUser.pseudo == pseudo, DBUser.deleted_at.is_(None))
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
                select(DBUser).where(DBUser.id == user_id, DBUser.deleted_at.is_(None))
            )
            user_db = result.scalar_one_or_none()
            if user_db is None:
                raise UserNotFoundError
            return user_db.to_entity()
        except NoResultFound:
            raise UserNotFoundError
        except:
            raise

    async def create(self, user: User):
        user_db = DBUser.from_entity(user)
        try:
            self.session.add(user_db)
            await self.session.flush()
            user.id = user_db.id
            user.created_at = user_db.created_at
            user.updated_at = user_db.updated_at
        except:
            raise

    async def find_users(self) -> List[User]:
        try:
            result = await self.session.execute(
                select(DBUser).where(DBUser.deleted_at.is_(None)).order_by(DBUser.pseudo)
            )
            user_dbs = result.scalars().all()
            if not user_dbs:
                return []
            return [user_db.to_entity() for user_db in user_dbs]
        except:
            raise

    async def delete_user(self, user_id: int):
        try:
            now = datetime.now(UTC)
            deleted_at = int(now.timestamp() * 1000)
            placeholder = f"deleted-user-{user_id}-{deleted_at}"
            result = await self.session.execute(
                update(DBUser)
                .where(DBUser.id == user_id, DBUser.deleted_at.is_(None))
                .values(
                    email=f"deleted{user_id}.{deleted_at}@deletedlocal.com",
                    pseudo=placeholder,
                    password=f"deleted::{placeholder}",
                    uuid=shortuuid.uuid(),
                    two_factor_secret=None,
                    is_two_factor_enabled=False,
                    is_two_factor_verified=False,
                    is_tournament_subscriber=False,
                    deleted_at=deleted_at,
                    auth_revoked_at=int(now.timestamp()),
                    updated_at=deleted_at,
                )
            )
            if (result.rowcount or 0) != 1:
                raise UserNotFoundError
        except:
            raise

    async def update(self, user: User):
        try:
            result = await self.session.execute(
                select(DBUser).where(DBUser.id == user.id, DBUser.deleted_at.is_(None))
            )
            _user = result.scalar_one()
            user_db = DBUser.from_entity(user, _user)
        except:
            raise

    async def get_all_rank_users(self) -> List[Dict[str, any]]:
        try:
            result = await self.session.execute(
                select(
                    DBUser.btl_from_tickets.label("nb_btl"),
                    DBUser.nb_win.label("nb_win"),
                    DBUser.nb_lose.label("nb_lose"),
                    DBUser.pseudo.label("pseudo"),
                    func.rank().over(
                        order_by=DBUser.btl_from_tickets.desc()
                    ).label("position")
                ).where(DBUser.deleted_at.is_(None)).order_by(DBUser.btl_from_tickets.desc())
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

    async def debit_btl_if_enough(self, user_id: int, amount: float) -> bool:
        if amount <= 0:
            return True
        stmt = (
            update(DBUser)
            .where(DBUser.id == user_id, DBUser.nb_btl >= amount, DBUser.deleted_at.is_(None))
            .values(nb_btl=DBUser.nb_btl - amount)
        )
        result = await self.session.execute(stmt)
        return (result.rowcount or 0) == 1

    async def credit_btl(self, user_id: int, amount: float) -> None:
        if amount <= 0:
            return
        await self.session.execute(
            update(DBUser)
            .where(DBUser.id == user_id, DBUser.deleted_at.is_(None))
            .values(nb_btl=DBUser.nb_btl + amount)
        )

    async def apply_ticket_win(self, user_id: int, gain: float) -> None:
        await self.session.execute(
            update(DBUser)
            .where(DBUser.id == user_id, DBUser.deleted_at.is_(None))
            .values(
                nb_win=DBUser.nb_win + 1,
                nb_btl=DBUser.nb_btl + gain,
                btl_from_tickets=DBUser.btl_from_tickets + gain,
            )
        )

    async def apply_ticket_lose(self, user_id: int) -> None:
        await self.session.execute(
            update(DBUser)
            .where(DBUser.id == user_id, DBUser.deleted_at.is_(None))
            .values(nb_lose=DBUser.nb_lose + 1)
        )

    async def begin(self):
        await self.session.begin()

    async def commit(self):
        await self.session.commit()

    async def rollback(self):
        await self.session.rollback()

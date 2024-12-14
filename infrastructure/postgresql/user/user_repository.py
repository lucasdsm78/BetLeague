from typing import Optional, List

from sqlalchemy.exc import NoResultFound
from sqlalchemy.orm.session import Session

from domain.user.exception.user_exception import UserNotFoundError
from domain.user.model.user import User
from domain.user.repository.user_repository import UserRepository
from infrastructure.postgresql.user.db_user import DBUser


class UserRepositoryImpl(UserRepository):

    def __init__(self, session: Session):
        self.session: Session = session

    def find_by_email(self, email: str) -> Optional[User]:
        try:
            user_db = self.session.query(DBUser).filter_by(email=email).one()
        except NoResultFound:
            return None
        except:
            raise

        return user_db.to_entity()

    def find_by_id(self, user_id: int) -> Optional[User]:
        try:
            user_db = self.session.query(DBUser).filter_by(id=user_id).one()
        except NoResultFound:
            raise UserNotFoundError
        except Exception:
            raise

        return user_db.to_entity()

    def create(self, user: User):
        user_db = DBUser.from_entity(user)
        try:
            self.session.add(user_db)
        except:
            raise

    def find_users(self) -> List[User]:
        try:
            user_dbs = (
                self.session.query(DBUser)
                .order_by(DBUser.last_name)
                .all()
            )
        except:
            raise

        if len(user_dbs) == 0:
            return []

        return list(map(lambda user_db: user_db.to_entity(), user_dbs))

    def delete_user(self, user_id: int):
        try:
            self.session.query(DBUser).filter_by(id=user_id).delete()
        except:
            raise

    def begin(self):
        self.session.begin()

    def commit(self):
        self.session.commit()

    def rollback(self):
        self.session.rollback()

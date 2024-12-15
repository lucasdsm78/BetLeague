from datetime import datetime
from typing import Union, Optional

from sqlalchemy import Column, Integer, String, BigInteger, Boolean

from domain.user.model.email import Email
from domain.user.model.password import Password
from domain.user.model.user import User
from infrastructure.postgresql.database import Base


def unixtimestamp() -> int:
    return int(datetime.now().timestamp() * 1000)


class DBUser(Base):
    __tablename__ = "user"
    id: Union[int, Column] = Column(BigInteger, primary_key=True, autoincrement=True)
    email: Union[str, Column] = Column(String(17), unique=True, nullable=False)
    uuid: Union[str, Column] = Column(String, unique=True, nullable=False)
    password: Union[str, Column] = Column(String, nullable=True)
    created_at: Union[int, Column] = Column(BigInteger, index=True, nullable=False)
    updated_at: Union[int, Column] = Column(BigInteger, index=True, nullable=False)
    first_name: Union[str, Column] = Column(String, nullable=False)
    pseudo: Union[str, Column] = Column(String, nullable=False)
    last_name: Union[str, Column] = Column(String, nullable=False)
    two_factor_secret: Union[Optional[str], Column] = Column(String, nullable=True)
    is_two_factor_enabled: Union[bool, Column] = Column(Boolean, default=False)
    is_two_factor_verified: Union[bool, Column] = Column(Boolean, default=False)

    def to_entity(self) -> User:
        return User(
            id=self.id,
            uuid=self.uuid,
            email=Email(self.email),
            password=Password(self.password),
            created_at=self.created_at,
            updated_at=self.updated_at,
            first_name=self.first_name,
            pseudo=self.pseudo,
            last_name=self.last_name,
            two_factor_secret=self.two_factor_secret,
            is_two_factor_enabled=self.is_two_factor_enabled,
            is_two_factor_verified=self.is_two_factor_verified
        )

    @staticmethod
    def from_entity(user: User, db_user: Optional["DBUser"] = None) -> "DBUser":
        now = unixtimestamp()
        user_db_to_update = db_user if db_user is not None else DBUser()
        user_db_to_update.id = user.id
        user_db_to_update.uuid = user.uuid
        user_db_to_update.email = user.email.value
        user_db_to_update.password = user.password.password
        user_db_to_update.created_at = now
        user_db_to_update.updated_at = now
        user_db_to_update.first_name = user.first_name
        user_db_to_update.last_name = user.last_name
        user_db_to_update.pseudo = user.pseudo
        user_db_to_update.two_factor_secret = user.two_factor_secret
        user_db_to_update.is_two_factor_enabled = user.is_two_factor_enabled
        user_db_to_update.is_two_factor_verified = user.is_two_factor_verified

        return user_db_to_update

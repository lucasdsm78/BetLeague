from datetime import datetime
from typing import Union, Optional
from sqlalchemy import Float

from sqlalchemy import Column, Integer, String, BigInteger, Boolean
from sqlalchemy.orm import relationship

from domain.user.model.email import Email
from domain.user.model.password import Password
from domain.user.model.user import User
from infrastructure.postgresql.database import Base


def unixtimestamp() -> int:
    return int(datetime.now().timestamp() * 1000)


class DBUser(Base):
    __tablename__ = "user"
    id: Union[int, Column] = Column(BigInteger, primary_key=True, autoincrement=True, index=True)
    email: Union[str, Column] = Column(String(17), unique=True, nullable=False, index=True)
    uuid: Union[str, Column] = Column(String, unique=True, nullable=False)
    password: Union[str, Column] = Column(String, nullable=True)
    created_at: Union[int, Column] = Column(BigInteger, index=True, nullable=False)
    updated_at: Union[int, Column] = Column(BigInteger, index=True, nullable=False)
    first_name: Union[str, Column] = Column(String, nullable=False)
    pseudo: Union[str, Column] = Column(String, nullable=False)
    last_name: Union[str, Column] = Column(String, nullable=False)
    nb_win: Union[int, Column] = Column(Integer, default=0)
    nb_lose: Union[int, Column] = Column(Integer, default=0)
    nb_btl: Union[float, Column] = Column(Float, default=0)
    two_factor_secret: Union[Optional[str], Column] = Column(String, nullable=True)
    is_two_factor_enabled: Union[bool, Column] = Column(Boolean, default=False)
    is_two_factor_verified: Union[bool, Column] = Column(Boolean, default=False)
    leagues = relationship("DBLeague", back_populates="user")
    league_players = relationship("DBLeaguePlayers", back_populates="user")
    invitations = relationship("DBInvitation", back_populates="user")
    tickets = relationship("DBTicket", back_populates="user")

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
            nb_win=self.nb_win,
            nb_lose=self.nb_lose,
            nb_btl=self.nb_btl,
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
        user_db_to_update.nb_lose = user.nb_lose
        user_db_to_update.nb_btl = user.nb_btl
        user_db_to_update.nb_win = user.nb_win
        user_db_to_update.two_factor_secret = user.two_factor_secret
        user_db_to_update.is_two_factor_enabled = user.is_two_factor_enabled
        user_db_to_update.is_two_factor_verified = user.is_two_factor_verified

        return user_db_to_update

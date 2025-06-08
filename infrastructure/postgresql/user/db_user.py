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
    email = Column(String(255), unique=True, nullable=False)
    uuid = Column(String(30), unique=True, nullable=False)  # Augmentation de la taille
    password = Column(String(255), nullable=False)
    created_at: Union[int, Column] = Column(BigInteger, index=True, nullable=False)
    updated_at: Union[int, Column] = Column(BigInteger, index=True, nullable=False)
    pseudo: Union[str, Column] = Column(String, nullable=False)
    nb_win: Union[int, Column] = Column(Integer, default=0)
    nb_lose: Union[int, Column] = Column(Integer, default=0)
    nb_btl: Union[float, Column] = Column(Float, default=200)
    two_factor_secret: Union[Optional[str], Column] = Column(String, nullable=True)
    is_two_factor_enabled: Union[bool, Column] = Column(Boolean, default=False)
    is_two_factor_verified: Union[bool, Column] = Column(Boolean, default=False)
    is_tournament_subscriber: Union[bool, Column] = Column(Boolean, default=False)
    leagues = relationship("DBLeague", foreign_keys="[DBLeague.user_id]", back_populates="user")
    league_players = relationship("DBLeaguePlayers", back_populates="user")
    tickets = relationship("DBTicket", back_populates="user")
    tournaments = relationship("DBTournament", foreign_keys="[DBTournament.user_id]", back_populates="user")
    tournaments_players = relationship("DBTournamentPlayer", foreign_keys="[DBTournamentPlayer.user_id]", back_populates="user")
    tournament_stages = relationship("DBTournamentStage", foreign_keys="[DBTournamentStage.user_id]", back_populates="user")

    def to_entity(self) -> User:
        return User(
            id=self.id,
            uuid=self.uuid,
            email=Email(self.email),
            password=Password(self.password),
            created_at=self.created_at,
            updated_at=self.updated_at,
            pseudo=self.pseudo,
            nb_win=self.nb_win,
            nb_lose=self.nb_lose,
            is_tournament_subscriber=self.is_tournament_subscriber,
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
        user_db_to_update.is_tournament_subscriber = user.is_tournament_subscriber
        user_db_to_update.updated_at = now
        user_db_to_update.pseudo = user.pseudo
        user_db_to_update.nb_lose = user.nb_lose
        user_db_to_update.nb_btl = user.nb_btl
        user_db_to_update.nb_win = user.nb_win
        user_db_to_update.two_factor_secret = user.two_factor_secret
        user_db_to_update.is_two_factor_enabled = user.is_two_factor_enabled
        user_db_to_update.is_two_factor_verified = user.is_two_factor_verified

        return user_db_to_update
